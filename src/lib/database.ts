console.log('开始执行 database.ts');

import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { PriceData } from '../types/exchange';
import { ExchangeSymbol } from '@/types/exchange';

// 使用相对路径
const DB_PATH = join(process.cwd(), 'data/prices.db');

export class DatabaseManager {
    private static instance: DatabaseManager | null = null;
    private db: Database.Database;

    private constructor() {
        const dataDir = dirname(DB_PATH);
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        this.db = new Database(DB_PATH);
        this.initTables();
    }

    private initTables(): void {
        console.log('开始初始化数据库表');
        try {
            // 创建交易对表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS symbols (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT,
                    market_type TEXT,
                    exchanges INTEGER DEFAULT 0,  -- 位运算: 1=Binance, 2=OKEx, 4=Bybit
                    fetch INTEGER DEFAULT 1,      -- 1=获取, 0=忽略
                    base_asset TEXT,             -- 基础资产 (如果需要)
                    quote_asset TEXT,            -- 计价资产 (如果需要)
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (symbol, market_type)
                )
            `);
            console.log('symbols 表创建/确认完成');

            // 创建价格表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT,
                    market_type TEXT,
                    binance_price REAL,
                    okex_price REAL,
                    bybit_price REAL,
                    binance_funding_rate TEXT,
                    okex_funding_rate TEXT,
                    bybit_funding_rate TEXT,
                    binance_next_funding_time INTEGER,
                    okex_next_funding_time INTEGER,
                    bybit_next_funding_time INTEGER,
                    timestamp INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (symbol, market_type)
                )
            `);
            console.log('prices 表创建/确认完成');
        } catch (error) {
            console.error('初始化数据库表时发生错误:', error);
            throw error;
        }
    }

    public static async getInstance(): Promise<DatabaseManager> {
        console.log('调用 DatabaseManager.getInstance()');
        if (!DatabaseManager.instance) {
            console.log('创建新的 DatabaseManager 实例');
            DatabaseManager.instance = new DatabaseManager();
            console.log('DatabaseManager 实例创建完成');
        }
        return DatabaseManager.instance;
    }

    public getSymbols(marketType: string = 'spot'): ExchangeSymbol[] {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE market_type = ? ORDER BY symbol');
        const results = stmt.all(marketType) as any[];
        return results.map(row => ({
            symbol: row.symbol,
            baseAsset: row.base_asset,
            quoteAsset: row.quote_asset,
            marketType: row.market_type,
            exchanges: row.exchanges,
            fetch: row.fetch
        }));
    }

    public getPrices(marketType: string = 'spot', page: number = 1, pageSize: number = 10, search: string = ''): { 
        data: PriceData[]; 
        pagination: { 
            total: number; 
            page: number; 
            pageSize: number; 
            totalPages: number; 
        }; 
    } {
        const offset = (page - 1) * pageSize;
        let whereClause = 'WHERE p.market_type = ?';
        let params: any[] = [marketType];

        if (search) {
            whereClause += ' AND p.symbol LIKE ?';
            params.push(`%${search}%`);
        }

        const countStmt = this.db.prepare(`
            SELECT COUNT(*) as total
            FROM prices p
            ${whereClause}
        `);
        const result = countStmt.get(...params) as { total: number };
        const total = result.total;

        const stmt = this.db.prepare(`
            SELECT p.*, s.fetch
            FROM prices p
            LEFT JOIN symbols s ON p.symbol = s.symbol 
                AND p.market_type = s.market_type
            ${whereClause}
            ORDER BY p.symbol
            LIMIT ? OFFSET ?
        `);
        
        const rows = stmt.all(...params, pageSize, offset) as PriceData[];
        
        return {
            data: rows,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

    public close(): void {
        console.log('调用 close()');
        this.db.close();
    }

    public getCachedSymbols(marketType: 'spot' | 'perpetual'): ExchangeSymbol[] {
        return this.getSymbols(marketType);
    }

    public getCachedPrices(marketType: 'spot' | 'perpetual'): PriceData[] {
        return this.getPrices(marketType).data;
    }

    public async getSymbol(symbol: string, marketType: string) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE symbol = ? AND market_type = ?');
        return stmt.get(symbol, marketType);
    }

    public async updateSymbol(data: {
        symbol: string;
        marketType: string;
        base_asset: string;
        quote_asset: string;
        exchanges: number;
    }): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT INTO symbols (symbol, market_type, base_asset, quote_asset, exchanges)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(symbol, market_type)
            DO UPDATE SET 
                exchanges = excluded.exchanges,
                base_asset = excluded.base_asset,
                quote_asset = excluded.quote_asset,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(
            data.symbol,
            data.marketType,
            data.base_asset,
            data.quote_asset,
            data.exchanges
        );
    }

    public async updatePrice(data: {
        symbol: string;
        marketType: string;
        price: number;
        exchangeId: string;
        fundingRate?: string;
        nextFundingTime?: number;
    }): Promise<void> {
        const priceColumn = `${data.exchangeId.toLowerCase()}_price`;
        const fundingRateColumn = `${data.exchangeId.toLowerCase()}_funding_rate`;
        const nextFundingTimeColumn = `${data.exchangeId.toLowerCase()}_next_funding_time`;

        const stmt = this.db.prepare(`
            INSERT INTO prices (
                symbol, market_type, ${priceColumn},
                ${data.fundingRate ? `${fundingRateColumn}, ${nextFundingTimeColumn},` : ''}
                timestamp
            )
            VALUES (
                ?, ?, ?,
                ${data.fundingRate ? '?, ?,' : ''}
                strftime('%s', 'now')
            )
            ON CONFLICT(symbol, market_type)
            DO UPDATE SET 
                ${priceColumn} = excluded.${priceColumn},
                ${data.fundingRate ? `
                ${fundingRateColumn} = excluded.${fundingRateColumn},
                ${nextFundingTimeColumn} = excluded.${nextFundingTimeColumn},
                ` : ''}
                timestamp = excluded.timestamp,
                updated_at = CURRENT_TIMESTAMP
        `);

        const params = [
            data.symbol,
            data.marketType,
            data.price
        ];

        if (data.fundingRate) {
            params.push(data.fundingRate, data.nextFundingTime);
        }

        stmt.run(...params);
    }

    public async updateSymbolFetch(symbol: string, marketType: string, fetch: number): Promise<void> {
        const stmt = this.db.prepare(`
            UPDATE symbols 
            SET fetch = ?, updated_at = CURRENT_TIMESTAMP
            WHERE symbol = ? AND market_type = ?
        `);
        stmt.run(fetch, symbol, marketType);
    }
}

export async function getDatabase(): Promise<DatabaseManager> {
    return DatabaseManager.getInstance();
}
