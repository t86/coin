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
            // 同步现货价格
            let [binanceSpotPrices, bybitSpotPrices, okexSpotPrices] = await Promise.all([
                BinanceService.getSpotPrices(),
                BybitService.getSpotPrices(),
                OkexService.getSpotPrices()
            ]);

            // 标准化所有交易所的货币对格式
            binanceSpotPrices = this.normalizeExchangePrices(binanceSpotPrices);
            bybitSpotPrices = this.normalizeExchangePrices(bybitSpotPrices);
            okexSpotPrices = this.normalizeExchangePrices(okexSpotPrices);
            
            // 分别更新每个交易所的价格
            await DatabaseManager.updatePrices('spot', binanceSpotPrices, 'binance');
            await DatabaseManager.updatePrices('spot', bybitSpotPrices, 'bybit');
            await DatabaseManager.updatePrices('spot', okexSpotPrices, 'okex');

            // 同步永续合约价格
            let [binancePerpPrices, bybitPerpPrices, okexPerpPrices] = await Promise.all([
                BinanceService.getPerpetualPrices(),
                BybitService.getPerpetualPrices(),
                OkexService.getPerpetualPrices()
            ]);

            // 标准化所有交易所的永续合约货币对格式
            binancePerpPrices = this.normalizeExchangePrices(binancePerpPrices);
            bybitPerpPrices = this.normalizeExchangePrices(bybitPerpPrices);
            okexPerpPrices = this.normalizeExchangePrices(okexPerpPrices);

            await DatabaseManager.updatePrices('perpetual', binancePerpPrices, 'binance');
            await DatabaseManager.updatePrices('perpetual', bybitPerpPrices, 'bybit');
            await DatabaseManager.updatePrices('perpetual', okexPerpPrices, 'okex');
        } catch (error) {
            console.error('Error syncing prices:', error);
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
