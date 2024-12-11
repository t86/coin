import Database from 'better-sqlite3';
import { PriceData } from '@/types/exchange';
import path from 'path';
import fs from 'fs';

class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database.Database | null = null;
    private symbolCache: Map<string, any[]> = new Map();
    private priceCache: Map<string, PriceData[]> = new Map();
    private initialized = false;

    private constructor() {}

    private async ensureDbDirectory() {
        const dbDir = path.join(process.cwd(), 'data');
        try {
            await fs.promises.mkdir(dbDir, { recursive: true });
        } catch (error) {
            console.error('Error creating database directory:', error);
            throw error;
        }
    }

    private async initializeDb() {
        if (this.initialized) return;

        try {
            await this.ensureDbDirectory();
            const dbPath = path.join(process.cwd(), 'data', 'prices.db');

            // 如果数据库文件不存在，创建一个空文件
            if (!fs.existsSync(dbPath)) {
                fs.writeFileSync(dbPath, '');
            }

            this.db = new Database(dbPath);
            this.initDatabase();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    private initDatabase() {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // 创建symbols表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS symbols (
                    symbol TEXT PRIMARY KEY,
                    baseAsset TEXT,
                    quoteAsset TEXT,
                    marketType TEXT
                )
            `);

            // 创建prices表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS prices (
                    symbol TEXT,
                    marketType TEXT,
                    binancePrice TEXT,
                    okexPrice TEXT,
                    bybitPrice TEXT,
                    updatedAt INTEGER,
                    PRIMARY KEY (symbol, marketType)
                )
            `);

            // 从数据库加载数据到缓存
            this.loadCacheFromDb();
        } catch (error) {
            console.error('Error initializing database tables:', error);
            throw error;
        }
    }

    private loadCacheFromDb() {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // 加载symbols
            const spotSymbols = this.db.prepare('SELECT * FROM symbols WHERE marketType = ?').all('spot');
            const perpetualSymbols = this.db.prepare('SELECT * FROM symbols WHERE marketType = ?').all('perpetual');
            this.symbolCache.set('spot', spotSymbols);
            this.symbolCache.set('perpetual', perpetualSymbols);

            // 加载prices
            const spotPrices = this.db.prepare('SELECT * FROM prices WHERE marketType = ?').all('spot');
            const perpetualPrices = this.db.prepare('SELECT * FROM prices WHERE marketType = ?').all('perpetual');
            this.priceCache.set('spot', spotPrices);
            this.priceCache.set('perpetual', perpetualPrices);
        } catch (error) {
            console.error('Error loading cache from database:', error);
            throw error;
        }
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    async getSymbols(marketType: 'spot' | 'perpetual'): Promise<any[]> {
        await this.initializeDb();
        return this.symbolCache.get(marketType) || [];
    }

    async getPriceData(marketType: 'spot' | 'perpetual'): Promise<PriceData[]> {
        await this.initializeDb();
        return this.priceCache.get(marketType) || [];
    }

    async updateSymbols(marketType: 'spot' | 'perpetual', symbols: any[]) {
        await this.initializeDb();
        if (!this.db) throw new Error('Database not initialized');

        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO symbols (symbol, baseAsset, quoteAsset, marketType)
                VALUES (@symbol, @baseAsset, @quoteAsset, @marketType)
            `);

            const transaction = this.db.transaction((symbols: any[]) => {
                for (const symbol of symbols) {
                    stmt.run({
                        symbol: symbol.symbol,
                        baseAsset: symbol.baseAsset,
                        quoteAsset: symbol.quoteAsset,
                        marketType
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

    async updatePrices(marketType: 'spot' | 'perpetual', prices: PriceData[]) {
        await this.initializeDb();
        if (!this.db) throw new Error('Database not initialized');

        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO prices (
                    symbol, marketType, binancePrice, okexPrice, bybitPrice, updatedAt
                ) VALUES (
                    @symbol, @marketType, @binancePrice, @okexPrice, @bybitPrice, @updatedAt
                )
            `);

            const transaction = this.db.transaction((prices: PriceData[]) => {
                for (const price of prices) {
                    stmt.run({
                        symbol: price.symbol,
                        marketType,
                        binancePrice: price.binancePrice,
                        okexPrice: price.okexPrice,
                        bybitPrice: price.bybitPrice,
                        updatedAt: Date.now()
                    });
                }
            });

            transaction(prices);
            this.priceCache.set(marketType, prices);
        } catch (error) {
            console.error('Error updating prices:', error);
            throw error;
        }
    }

    async cleanOldData() {
        await this.initializeDb();
        if (!this.db) throw new Error('Database not initialized');

        try {
            const oneHourAgo = Date.now() - 3600000; // 1小时前
            this.db.prepare('DELETE FROM prices WHERE updatedAt < ?').run(oneHourAgo);
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
}

export default DatabaseManager.getInstance();
