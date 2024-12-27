import Database from 'better-sqlite3';
import { PriceData } from '../types/exchange';
import path from 'path';
import fs from 'fs';

class DatabaseManager {
    private static instance: DatabaseManager | null = null;
    private static initializationPromise: Promise<DatabaseManager> | null = null;
    private db: Database.Database | null = null;
    private symbolCache: Map<string, any[]> = new Map();
    private priceCache: Map<string, any[]> = new Map();
    private initialized = false;
    private lastCacheRefresh = 0;
    private cacheRefreshInterval = 10000; // 10秒

    private constructor() {}

    public static async getInstance(): Promise<DatabaseManager> {
        if (!DatabaseManager.initializationPromise) {
            DatabaseManager.initializationPromise = (async () => {
                if (!DatabaseManager.instance) {
                    DatabaseManager.instance = new DatabaseManager();
                    await DatabaseManager.instance.initialize();
                }
                return DatabaseManager.instance;
            })();
        }
        return DatabaseManager.initializationPromise;
    }

    // 确保数据库目录存在
    private ensureDbDirectory() {
        const dbDir = path.dirname(this.getDbPath());
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    // 获取数据库文件路径
    private getDbPath(): string {
        return path.join(process.cwd(), 'data', 'prices.db');
    }

    // 初始化数据库连接
    async initialize() {
        if (this.db) return;

        try {
            this.ensureDbDirectory();
            const dbPath = this.getDbPath();
            console.log(`[DatabaseManager] Initializing database at: ${dbPath}`);
            
            this.db = new Database(dbPath);
            this.initDatabase();
            
            console.log('[DatabaseManager] Database initialized successfully');
        } catch (error) {
            console.error('[DatabaseManager] Error initializing database:', error);
            throw error;
        }
    }

    // 初始化数据库表
    private initDatabase() {
        if (!this.db) return;

        console.log('[DatabaseManager] Initializing database tables...');

        try {
            // 创建交易对表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS symbols (
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    type TEXT NOT NULL,
                    fetch INTEGER DEFAULT 1,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                    PRIMARY KEY (symbol, exchange, type)
                )
            `);

            // 删除旧的prices表
            this.db.exec(`DROP TABLE IF EXISTS prices`);

            // 创建新的prices表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS prices (
                    symbol TEXT NOT NULL,
                    marketType TEXT NOT NULL,
                    binancePrice REAL,
                    okexPrice REAL,
                    bybitPrice REAL,
                    binanceFundingRate REAL,
                    okexFundingRate REAL,
                    bybitFundingRate REAL,
                    timestamp INTEGER,
                    PRIMARY KEY (symbol, marketType)
                )
            `);

            // 验证表是否创建成功
            const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            console.log('[DatabaseManager] Available tables:', tables);

            // 添加 fetch 字段的迁移
            try {
                this.db.exec(`ALTER TABLE symbols ADD COLUMN fetch INTEGER DEFAULT 1`);
            } catch (error) {
                // 如果字段已存在，忽略错误
            }
        } catch (error) {
            console.error('[DatabaseManager] Error initializing database:', error);
            throw error;
        }
    }

    private async refreshCacheIfNeeded() {
        const now = Date.now();
        if (now - this.lastCacheRefresh >= this.cacheRefreshInterval) {
            await this.loadCacheFromDb();
            this.lastCacheRefresh = now;
        }
    }

    private async loadCacheFromDb() {
        if (!this.db) throw new Error('Database not initialized');

        try {
            console.log('[DatabaseManager] Refreshing cache from database...');
            
            // 加载symbols
            const spotSymbols = this.db.prepare('SELECT * FROM symbols WHERE type = ?').all('spot');
            const perpetualSymbols = this.db.prepare('SELECT * FROM symbols WHERE type = ?').all('perpetual');
            this.symbolCache.set('spot', spotSymbols);
            this.symbolCache.set('perpetual', perpetualSymbols);

            // 加载prices
            const spotPrices = this.db.prepare('SELECT * FROM prices WHERE marketType = ?').all('spot');
            const perpetualPrices = this.db.prepare('SELECT * FROM prices WHERE marketType = ?').all('perpetual');
            this.priceCache.set('spot', spotPrices);
            this.priceCache.set('perpetual', perpetualPrices);
            
            this.lastCacheRefresh = Date.now();
        } catch (error) {
            console.error('Error loading cache from database:', error);
            throw error;
        }
    }

    private normalizeSymbol(symbol: string, marketType: 'spot' | 'perpetual'): string {
        // Remove any hyphens and convert to uppercase
        let normalized = symbol.replace(/-/g, '').toUpperCase();
        
        // For perpetual contracts, remove the SWAP suffix from OKEx symbols
        if (marketType === 'perpetual') {
            normalized = normalized.replace('SWAP', '');
        }
        
        return normalized;
    }

    async getSymbols(marketType: 'spot' | 'perpetual'): Promise<any[]> {
        await this.initialize();
        await this.refreshCacheIfNeeded();
        return this.symbolCache.get(marketType) || [];
    }

    async getPriceData(marketType: 'spot' | 'perpetual'): Promise<any[]> {
        await this.initialize();
        await this.refreshCacheIfNeeded();
        return this.priceCache.get(marketType) || [];
    }

    async updateSymbols(marketType: 'spot' | 'perpetual', symbols: any[]) {
        await this.initialize();
        if (!this.db) throw new Error('Database not initialized');

        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO symbols (symbol, exchange, type, fetch)
                VALUES (@symbol, @exchange, @type, @fetch)
            `);

            const transaction = this.db.transaction((symbols: any[]) => {
                for (const symbol of symbols) {
                    stmt.run({
                        symbol: this.normalizeSymbol(symbol.symbol, marketType),
                        exchange: symbol.exchange,
                        type: marketType,
                        fetch: symbol.fetch
                    });
                }
            });

            transaction(symbols);
            this.symbolCache.set(marketType, symbols);
        } catch (error) {
            console.error('Error updating symbols:', error);
            throw error;
        }
    }

    async updatePrices(marketType: string, prices: any[], exchange: string) {
        if (!this.db) throw new Error('Database not initialized');

        try {
            console.log(`[DatabaseManager] Updating prices for ${exchange}, marketType: ${marketType}`);

            // 准备更新语句
            const stmt = this.db.prepare(`
                INSERT INTO prices (
                    symbol,
                    marketType,
                    ${exchange}Price,
                    ${exchange}FundingRate,
                    timestamp
                ) VALUES (
                    @symbol,
                    @marketType,
                    @price,
                    @fundingRate,
                    @timestamp
                )
                ON CONFLICT(symbol, marketType) DO UPDATE SET
                    ${exchange}Price = @price,
                    ${exchange}FundingRate = @fundingRate,
                    timestamp = @timestamp
            `);

            // 在事务外先准备要插入的数据
            const paramsToInsert = prices.map(price => ({
                symbol: price.symbol,
                marketType,
                price: price.price || 0,
                fundingRate: price.fundingRate,
                timestamp: Date.now()
            }));

            console.log(`[DatabaseManager] Preparing to insert:`, paramsToInsert);

            const transaction = this.db.transaction((params: any[]) => {
                for (const param of params) {
                    const result = stmt.run(param);
                    console.log(`[DatabaseManager] Insert result:`, result);
                }
            });

            // 执行事务
            transaction(paramsToInsert);

            // 验证数据是否已插入
            const verifyPrices = this.db.prepare(`
                SELECT 
                    symbol, 
                    marketType,
                    binancePrice,
                    okexPrice,
                    bybitPrice,
                    binanceFundingRate,
                    okexFundingRate,
                    bybitFundingRate,
                    timestamp
                FROM prices 
                WHERE marketType = ? 
                AND ${exchange}Price IS NOT NULL
            `).all(marketType);
            console.log(`[DatabaseManager] Verification result:`, verifyPrices);

            // 更新缓存
            const updatedPrices = this.db.prepare('SELECT * FROM prices WHERE marketType = ?').all(marketType);
            this.priceCache.set(marketType, updatedPrices);
            console.log(`[DatabaseManager] Updated ${prices.length} prices for ${marketType} market, cache updated with ${updatedPrices.length} records`);

        } catch (error) {
            console.error('Error updating prices:', error);
            throw error;
        }
    }

    async cleanOldData() {
        await this.initialize();
        if (!this.db) throw new Error('Database not initialized');

        try {
            const oneHourAgo = Date.now() - 3600000; // 1小时前
            this.db.prepare('DELETE FROM prices WHERE timestamp < ?').run(oneHourAgo);
        } catch (error) {
            console.error('Error cleaning old data:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
                this.initialized = false;
            } catch (error) {
                console.error('Error closing database:', error);
                throw error;
            }
        }
    }

    async getAllSymbols() {
        if (!this.db) throw new Error('Database not initialized');
        const spotSymbols = await this.getSymbols('spot');
        const perpetualSymbols = await this.getSymbols('perpetual');
        return [...spotSymbols, ...perpetualSymbols];
    }

    async getLastUpdates(): Promise<Map<string, number>> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            interface UpdateRow {
                symbol: string;
                marketType: string;
                last_update: number;
            }

            const results = this.db.prepare(`
                SELECT symbol, marketType, MAX(timestamp) as last_update
                FROM prices
                GROUP BY symbol, marketType
            `).all() as UpdateRow[];

            const updates = new Map<string, number>();
            for (const row of results) {
                updates.set(`${row.symbol}_${row.marketType}`, row.last_update);
            }
            return updates;
        } catch (error) {
            console.error('Error getting last updates:', error);
            throw error;
        }
    }

    // 获取缓存的交易对数据
    getCachedSymbols(marketType: 'spot' | 'perpetual'): any[] {
        return this.symbolCache.get(marketType) || [];
    }

    // 获取缓存的价格数据
    getCachedPrices(marketType: 'spot' | 'perpetual'): any[] {
        return this.priceCache.get(marketType) || [];
    }
}

// 创建并导出单例实例
export async function getDatabase(): Promise<DatabaseManager> {
    return DatabaseManager.getInstance();
}

// 导出类以供类型使用
export { DatabaseManager };
