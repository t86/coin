import { PriceData, ExchangeSymbol, Exchange } from '../types/exchange';
import { getDatabase } from './database';
import BinanceService from '../services/binance';
import BybitService from '../services/bybit';
import OkexService from '../services/okex';
import { SymbolNormalizer } from '../services/symbol-normalizer';

export class DataSyncService {
    private static instance: DataSyncService | null = null;
    private static initializationPromise: Promise<DataSyncService> | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private symbolSyncInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly SYNC_INTERVAL = 60000; // 1 minute
    private readonly SYMBOL_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

    private constructor() {}

    public static async getInstance(): Promise<DataSyncService> {
        if (!DataSyncService.initializationPromise) {
            DataSyncService.initializationPromise = (async () => {
                if (!DataSyncService.instance) {
                    DataSyncService.instance = new DataSyncService();
                    await DataSyncService.instance.initialize();
                }
                return DataSyncService.instance;
            })();
        }
        return DataSyncService.initializationPromise;
    }

    private async initialize() {
        // 初始化数据库连接
        const db = await getDatabase();
        console.log('[DataSyncService] Initialized');
    }

    public async startSync() {
        console.log('[DataSyncService] Starting sync service...');
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        if (this.symbolSyncInterval) {
            clearInterval(this.symbolSyncInterval);
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // 立即执行一次同步
        await this.syncSymbols();
        await this.syncPrices();

        // 设置定时同步
        this.syncInterval = setInterval(async () => {
            await this.syncPrices();
        }, this.SYNC_INTERVAL);

        this.symbolSyncInterval = setInterval(async () => {
            await this.syncSymbols();
        }, this.SYMBOL_SYNC_INTERVAL);

        this.cleanupInterval = setInterval(async () => {
            try {
                const db = await getDatabase();
                await db.cleanOldData();
            } catch (error) {
                console.error('Data cleanup failed:', error);
            }
        }, this.CLEANUP_INTERVAL);

        console.log('[DataSyncService] Sync service started');
    }

    private async syncSymbols() {
        try {
            const db = await getDatabase();

            // 获取各交易所的交易对
            const [binanceSpot, binancePerpetual] = await Promise.all([
                BinanceService.fetchSymbols('spot'),
                BinanceService.fetchSymbols('perpetual')
            ]);

            const [okexSpot, okexPerpetual] = await Promise.all([
                OkexService.fetchSymbols('spot'),
                OkexService.fetchSymbols('perpetual')
            ]);

            const [bybitSpot, bybitPerpetual] = await Promise.all([
                BybitService.fetchSymbols('spot'),
                BybitService.fetchSymbols('perpetual')
            ]);

            // 创建符号映射，用于合并相同的交易对
            const spotSymbolMap = new Map<string, ExchangeSymbol>();
            const perpetualSymbolMap = new Map<string, ExchangeSymbol>();

            // 处理现货交易对
            for (const symbol of binanceSpot) {
                spotSymbolMap.set(symbol.symbol, {
                    ...symbol,
                    exchanges: Exchange.Binance
                });
            }

            for (const symbol of okexSpot) {
                const existing = spotSymbolMap.get(symbol.symbol);
                if (existing) {
                    existing.exchanges |= Exchange.OKEx;
                } else {
                    spotSymbolMap.set(symbol.symbol, {
                        ...symbol,
                        exchanges: Exchange.OKEx
                    });
                }
            }

            for (const symbol of bybitSpot) {
                const existing = spotSymbolMap.get(symbol.symbol);
                if (existing) {
                    existing.exchanges |= Exchange.Bybit;
                } else {
                    spotSymbolMap.set(symbol.symbol, {
                        ...symbol,
                        exchanges: Exchange.Bybit
                    });
                }
            }

            // 处理永续合约交易对
            for (const symbol of binancePerpetual) {
                perpetualSymbolMap.set(symbol.symbol, {
                    ...symbol,
                    exchanges: Exchange.Binance
                });
            }

            for (const symbol of okexPerpetual) {
                const existing = perpetualSymbolMap.get(symbol.symbol);
                if (existing) {
                    existing.exchanges |= Exchange.OKEx;
                } else {
                    perpetualSymbolMap.set(symbol.symbol, {
                        ...symbol,
                        exchanges: Exchange.OKEx
                    });
                }
            }

            for (const symbol of bybitPerpetual) {
                const existing = perpetualSymbolMap.get(symbol.symbol);
                if (existing) {
                    existing.exchanges |= Exchange.Bybit;
                } else {
                    perpetualSymbolMap.set(symbol.symbol, {
                        ...symbol,
                        exchanges: Exchange.Bybit
                    });
                }
            }

            // 更新数据库
            await db.updateSymbols('spot', Array.from(spotSymbolMap.values()));
            await db.updateSymbols('perpetual', Array.from(perpetualSymbolMap.values()));

        } catch (error) {
            console.error('Error syncing symbols:', error);
            throw error;
        }
    }

    private async syncPrices() {
        try {
            const db = await getDatabase();
            const allSymbols = await db.getAllSymbols();

            // 只获取需要同步的交易对
            const symbolsToFetch = allSymbols.filter(symbol => symbol.fetch === 1);

            // 按交易所分组
            const symbolsByExchange = {
                Binance: symbolsToFetch.filter(s => s.exchange === 'Binance'),
                Bybit: symbolsToFetch.filter(s => s.exchange === 'Bybit'),
                OKEx: symbolsToFetch.filter(s => s.exchange === 'OKEx')
            };

            // 并行获取每个交易所的价格
            const fetchPromises = [];

            // Binance
            if (symbolsByExchange.Binance.length > 0) {
                fetchPromises.push(this.fetchExchangePrices(
                    symbolsByExchange.Binance,
                    BinanceService.fetchSinglePrice,
                    'Binance'
                ));
            }

            // Bybit
            if (symbolsByExchange.Bybit.length > 0) {
                fetchPromises.push(this.fetchExchangePrices(
                    symbolsByExchange.Bybit,
                    BybitService.fetchSinglePrice,
                    'Bybit'
                ));
            }

            // OKEx
            if (symbolsByExchange.OKEx.length > 0) {
                fetchPromises.push(this.fetchExchangePrices(
                    symbolsByExchange.OKEx,
                    OkexService.fetchSinglePrice,
                    'OKEx'
                ));
            }

            await Promise.all(fetchPromises);
            console.log('[DataSyncService] Price sync completed');
        } catch (error) {
            console.error('[DataSyncService] Price sync failed:', error);
        }
    }

    private async fetchExchangePrices(
        symbols: Array<{ symbol: string; type: 'spot' | 'perpetual' }>,
        fetchPrice: (symbol: string, type: 'spot' | 'perpetual') => Promise<PriceData | null>,
        exchange: string
    ) {
        try {
            const updates = [];

            for (const symbol of symbols) {
                const price = await fetchPrice(symbol.symbol, symbol.type);
                if (price) {
                    updates.push({
                        exchange,
                        data: {
                            symbol: symbol.symbol,
                            price: price.price,
                            fundingRate: symbol.type === 'perpetual' ? price.fundingRate : null
                        }
                    });
                }
            }

            if (updates.length > 0) {
                const db = await getDatabase();
                await Promise.all(updates.map(update => 
                    db.updatePrices(update.data.symbol, [update.data], update.exchange)
                ));
            }
        } catch (error) {
            console.error(`Error fetching prices for ${exchange}:`, error);
        }
    }

    public stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.symbolSyncInterval) {
            clearInterval(this.symbolSyncInterval);
            this.symbolSyncInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        console.log('[DataSyncService] Sync service stopped');
    }
}

export default DataSyncService;
