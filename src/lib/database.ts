console.log('开始执行 database.ts');

import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { PriceData } from '../types/exchange';
import { ExchangeSymbol } from '@/types/exchange';

// 使用 __dirname 替代 import.meta
const DB_PATH = join(__dirname, '../../data/prices.db');

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
                    exchange TEXT,
                    symbol TEXT,
                    market_type TEXT,
                    fetch INTEGER DEFAULT 1,
                    base_asset TEXT,
                    quote_asset TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (exchange, symbol, market_type)
                )
            `);
            console.log('symbols 表创建/确认完成');

            // 创建价格表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    exchange TEXT,
                    symbol TEXT,
                    market_type TEXT,
                    price REAL,
                    timestamp INTEGER,
                    funding_rate TEXT,
                    next_funding_time INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (exchange, symbol, market_type)
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

    public getSymbols(marketType: string = 'spot'): any[] {
        console.log('调用 getSymbols()');
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE market_type = ? ORDER BY exchange, symbol');
        return stmt.all(marketType);
    }

    public updateSymbol(exchange: string, symbol: string, marketType: string, fetch: number): void {
        console.log('调用 updateSymbol()');
        const stmt = this.db.prepare(`
            INSERT INTO symbols (exchange, symbol, market_type, fetch)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(exchange, symbol, market_type)
            DO UPDATE SET fetch = excluded.fetch
        `);
        stmt.run(exchange, symbol, marketType, fetch);
    }

    public updatePrice(exchange: string, symbol: string, marketType: string, price: number): void {
        console.log('调用 updatePrice()');
        const stmt = this.db.prepare(`
            INSERT INTO prices (exchange, symbol, market_type, price, timestamp)
            VALUES (?, ?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(exchange, symbol, market_type)
            DO UPDATE SET price = excluded.price, timestamp = excluded.timestamp
        `);
        stmt.run(exchange, symbol, marketType, price);
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
            whereClause += ' AND (p.exchange LIKE ? OR p.symbol LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
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
            LEFT JOIN symbols s ON p.exchange = s.exchange 
                AND p.symbol = s.symbol 
                AND p.market_type = s.market_type
            ${whereClause}
            ORDER BY p.exchange, p.symbol
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
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE market_type = ?');
        const results = stmt.all(marketType) as any[];
        return results.map(row => ({
            symbol: row.symbol,
            baseAsset: row.base_asset,
            quoteAsset: row.quote_asset,
            marketType: row.market_type,
            exchanges: row.exchanges
        }));
    }

    public getCachedPrices(marketType: 'spot' | 'perpetual'): PriceData[] {
        const stmt = this.db.prepare('SELECT * FROM prices WHERE type = ?');
        const results = stmt.all(marketType) as any[];
        return results.map(row => ({
            symbol: row.symbol,
            price: row.price,
            timestamp: row.timestamp,
            exchange: row.exchange,
            type: row.type,
            fundingRate: row.funding_rate,
            nextFundingTime: row.next_funding_time
        }));
    }
}

export async function getDatabase(): Promise<DatabaseManager> {
    return DatabaseManager.getInstance();
}

// CommonJS 兼容性支持
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DatabaseManager, getDatabase };
}
