import { PriceData } from '@/types/exchange';
import DatabaseManager from './database';
import BinanceService from '@/services/binance';
import BybitService from '@/services/bybit';
import OkexService from '@/services/okex';
import { SymbolStandardizationService } from '@/services/symbol-standardization';

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
            const spotPrices = await Promise.all([
                BinanceService.getSpotPrices(),
                BybitService.getSpotPrices(),
                OkexService.getSpotPrices()
            ]);
            await DatabaseManager.updatePrices('spot', this.mergePrices(spotPrices));

            // 同步永续合约价格
            const perpetualPrices = await Promise.all([
                BinanceService.getPerpetualPrices(),
                BybitService.getPerpetualPrices(),
                OkexService.getPerpetualPrices()
            ]);
            await DatabaseManager.updatePrices('perpetual', this.mergePrices(perpetualPrices));
        } catch (error) {
            console.error('Error syncing prices:', error);
            throw error;
        }
    }

    private mergeSymbols(symbolsFromExchanges: any[][]): any[] {
        const allSymbols = symbolsFromExchanges.flatMap((symbols, index) => {
            const exchange = ['binance', 'bybit', 'okex'][index];
            return symbols.map(symbol => SymbolStandardizationService.standardizeSymbolInfo(symbol, exchange));
        });
        
        return SymbolStandardizationService.mergeSymbolInfos(allSymbols);
    }

    private mergePrices(pricesArray: PriceData[][]): PriceData[] {
        const priceMap = new Map();
        pricesArray.flat().forEach(price => {
            priceMap.set(price.symbol, {
                ...priceMap.get(price.symbol),
                ...price
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
