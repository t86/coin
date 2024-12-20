import { PriceData } from '@/types/exchange';
import DatabaseManager from './database';
import BinanceService from '@/services/binance';
import BybitService from '@/services/bybit';
import OkexService from '@/services/okex';
import { SymbolNormalizer } from '@/services/symbol-normalizer';

class DataSyncService {
    private static instance: DataSyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private symbolSyncInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {}

    public static getInstance(): DataSyncService {
        if (!DataSyncService.instance) {
            DataSyncService.instance = new DataSyncService();
        }
        return DataSyncService.instance;
    }

    async startSync() {
        // 初始同步
        await this.syncSymbols();
        await this.syncPrices();

        // 设置定期同步
        this.setupPriceSync();
        this.setupSymbolSync();
        this.setupCleanup();
    }

    private setupPriceSync() {
        // 每分钟同步价格
        this.syncInterval = setInterval(async () => {
            try {
                await this.syncPrices();
            } catch (error) {
                console.error('Price sync failed:', error);
            }
        }, 60000); // 1分钟
    }

    private setupSymbolSync() {
        // 每24小时同步交易对
        this.symbolSyncInterval = setInterval(async () => {
            try {
                await this.syncSymbols();
            } catch (error) {
                console.error('Symbol sync failed:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24小时
    }

    private setupCleanup() {
        // 每小时清理旧数据
        this.cleanupInterval = setInterval(async () => {
            try {
                await DatabaseManager.cleanOldData();
            } catch (error) {
                console.error('Cleanup failed:', error);
            }
        }, 3600000); // 1小时
    }

    private async syncSymbols() {
        try {
            // 同步现货交易对
            const spotSymbols = await Promise.all([
                BinanceService.getSpotSymbols(),
                BybitService.getSpotSymbols(),
                OkexService.getSpotSymbols()
            ]);
            await DatabaseManager.updateSymbols('spot', this.mergeSymbols(spotSymbols));

            // 同步永续合约交易对
            const perpetualSymbols = await Promise.all([
                BinanceService.getPerpetualSymbols(),
                BybitService.getPerpetualSymbols(),
                OkexService.getPerpetualSymbols()
            ]);
            await DatabaseManager.updateSymbols('perpetual', this.mergeSymbols(perpetualSymbols));
        } catch (error) {
            console.error('Error syncing symbols:', error);
            throw error;
        }
    }

    private async syncPrices() {
        try {
            const db = await DatabaseManager.getInstance();
            const [binanceService, okexService, bybitService] = [
                new BinanceService(),
                new OkexService(),
                new BybitService()
            ];

            // 获取所有交易对
            const symbols = await db.getAllSymbols();

            // 并行获取价格和资金费率
            const pricePromises = symbols.map(async (symbol) => {
                const normalizedSymbol = symbol.symbol;
                const prices: PriceData[] = [];

                // Binance
                try {
                    const [price, fundingRate] = await Promise.all([
                        binanceService.getPrice(normalizedSymbol),
                        binanceService.getFundingRate(normalizedSymbol)
                    ]);
                    if (price) {
                        prices.push({
                            symbol: normalizedSymbol,
                            price: price,
                            exchange: 'Binance',
                            fundingRate: fundingRate?.rate || 0,
                            nextFundingTime: fundingRate?.nextFundingTime || 0
                        });
                    }
                } catch (error) {
                    console.error(`Binance sync failed for ${normalizedSymbol}:`, error);
                }

                // OKEx
                try {
                    const [price, fundingRate] = await Promise.all([
                        okexService.getPrice(normalizedSymbol),
                        okexService.getFundingRate(normalizedSymbol)
                    ]);
                    if (price) {
                        prices.push({
                            symbol: normalizedSymbol,
                            price: price,
                            exchange: 'OKEx',
                            fundingRate: fundingRate?.rate || 0,
                            nextFundingTime: fundingRate?.nextFundingTime || 0
                        });
                    }
                } catch (error) {
                    console.error(`OKEx sync failed for ${normalizedSymbol}:`, error);
                }

                // Bybit
                try {
                    const [price, fundingRate] = await Promise.all([
                        bybitService.getPrice(normalizedSymbol),
                        bybitService.getFundingRate(normalizedSymbol)
                    ]);
                    if (price) {
                        prices.push({
                            symbol: normalizedSymbol,
                            price: price,
                            exchange: 'Bybit',
                            fundingRate: fundingRate?.rate || 0,
                            nextFundingTime: fundingRate?.nextFundingTime || 0
                        });
                    }
                } catch (error) {
                    console.error(`Bybit sync failed for ${normalizedSymbol}:`, error);
                }

                return {
                    symbol: normalizedSymbol,
                    prices,
                    timestamp: Date.now()
                };
            });

            const results = await Promise.all(pricePromises);
            
            // 更新数据库
            for (const result of results) {
                if (result.prices.length > 0) {
                    await db.updatePrices(result);
                }
            }
        } catch (error) {
            console.error('Price sync failed:', error);
            throw error;
        }
    }

    private normalizeSymbol(symbol: string): string {
        // Remove any hyphens and convert to uppercase
        return symbol.replace(/-/g, '').toUpperCase();
    }

    private normalizeExchangePrices(prices: PriceData[]): PriceData[] {
        return prices.map(price => ({
            ...price,
            symbol: this.normalizeSymbol(price.symbol)
        }));
    }

    private mergeSymbols(symbolsArray: any[][]): any[] {
        const symbolMap = new Map();
        const exchanges = ['binance', 'bybit', 'okex'];
        
        symbolsArray.forEach((symbols, index) => {
            const exchange = exchanges[index];
            symbols.forEach(symbol => {
                const normalizedInfo = SymbolNormalizer.normalizeSymbolInfo(symbol, exchange);
                const key = normalizedInfo.normalizedSymbol;
                
                if (symbolMap.has(key)) {
                    const existing = symbolMap.get(key);
                    existing.exchanges = existing.exchanges || [];
                    existing.exchanges.push(exchange);
                    existing.originalSymbols = existing.originalSymbols || {};
                    existing.originalSymbols[exchange] = symbol.symbol;
                } else {
                    symbolMap.set(key, {
                        symbol: normalizedInfo.normalizedSymbol,
                        baseAsset: normalizedInfo.baseAsset,
                        quoteAsset: normalizedInfo.quoteAsset,
                        exchanges: [exchange],
                        originalSymbols: { [exchange]: symbol.symbol }
                    });
                }
            });
        });

        return Array.from(symbolMap.values());
    }

    private mergePrices(pricesArray: PriceData[][]): PriceData[] {
        const priceMap = new Map();
        const exchanges = ['binance', 'bybit', 'okex'];

        pricesArray.forEach((prices, index) => {
            const exchange = exchanges[index];
            prices.forEach(price => {
                const normalizedSymbol = SymbolNormalizer.normalize(price.symbol);
                
                if (priceMap.has(normalizedSymbol)) {
                    const existing = priceMap.get(normalizedSymbol);
                    existing[`${exchange}Price`] = price.price;
                } else {
                    priceMap.set(normalizedSymbol, {
                        symbol: normalizedSymbol,
                        binancePrice: exchange === 'binance' ? price.price : null,
                        bybitPrice: exchange === 'bybit' ? price.price : null,
                        okexPrice: exchange === 'okex' ? price.price : null
                    });
                }
            });
        });

        return Array.from(priceMap.values());
    }

    stopSync() {
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
    }
}

export default DataSyncService.getInstance();
