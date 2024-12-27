console.log('开始执行 data-sync-service.ts');

import ccxt, { Market, Exchange, BadSymbol } from 'ccxt';
import { DatabaseManager } from './database';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { fetch, ProxyAgent } from 'undici';

console.log('导入模块完成');

class DataSyncService {
    private static instance: DataSyncService | null = null;
    private db: DatabaseManager;
    private syncInterval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private exchanges: { [key: string]: Exchange } = {};

    private constructor(db: DatabaseManager) {
        this.db = db;
    }

    private async initializeExchanges() {
        try {
            console.log('初始化交易所连接...');
            const proxyAgent = new ProxyAgent('http://127.0.0.1:7890');
            
            const config = {
                enableRateLimit: true,
                timeout: 30000,
                fetchImplementation: async (url, options = {}) => {
                    return fetch(url, { 
                        ...options, 
                        dispatcher: proxyAgent 
                    });
                }
            };

            this.exchanges = {
                binance: new ccxt.binance(config),
                okex: new ccxt.okx(config),
                bybit: new ccxt.bybit(config)
            };

            // 测试连接
            for (const [id, exchange] of Object.entries(this.exchanges)) {
                try {
                    await exchange.loadMarkets();
                    console.log(`${id} 连接测试成功`);
                } catch (error) {
                    console.error(`${id} 连接测试失败:`, error);
                    throw error;
                }
            }

            console.log('交易所连接初始化完成');
        } catch (error) {
            console.error('初始化交易所连接时发生错误:', error);
            throw error;
        }
    }

    public static async getInstance(): Promise<DataSyncService> {
        if (!DataSyncService.instance) {
            try {
                console.log('创建 DataSyncService 实例...');
                const db = await DatabaseManager.getInstance();
                DataSyncService.instance = new DataSyncService(db);
                await DataSyncService.instance.initializeExchanges();
                console.log('DataSyncService 实例创建成功');
            } catch (error) {
                console.error('创建 DataSyncService 实例时发生错误:', error);
                throw error;
            }
        }
        return DataSyncService.instance;
    }

    private async syncSymbols(exchange: Exchange, marketType: string): Promise<void> {
        try {
            console.log(`正在同步 ${exchange.id} ${marketType} 交易对...`);
            const markets = await exchange.loadMarkets();
            const symbols = Object.values(markets)
                .filter((market: Market) => {
                    if (marketType === 'spot') {
                        return Boolean(market.spot);
                    } else if (marketType === 'perpetual') {
                        return Boolean(market.swap || market.future);
                    }
                    return false;
                })
                .map((market: Market) => ({
                    exchange: exchange.id,
                    symbol: market.symbol,
                    marketType,
                    fetch: 1
                }));

            console.log(`发现 ${symbols.length} 个 ${marketType} 交易对`);
            for (const symbol of symbols) {
                try {
                    this.db.updateSymbol(symbol.exchange, symbol.symbol, symbol.marketType, symbol.fetch);
                } catch (error) {
                    console.error(`更新交易对 ${symbol.symbol} 时发生错误:`, error);
                }
            }
            console.log(`${exchange.id} ${marketType} 交易对同步完成`);
        } catch (error) {
            console.error(`同步 ${exchange.id} ${marketType} 交易对时发生错误:`, error);
            throw error;
        }
    }

    private async syncPrices(exchange: Exchange, marketType: string): Promise<void> {
        try {
            console.log(`正在同步 ${exchange.id} ${marketType} 价格...`);
            const symbols = this.db.getSymbols(marketType);
            const fetchableSymbols = symbols.filter(s => s.fetch === 1 && s.exchange === exchange.id);
            console.log(`找到 ${fetchableSymbols.length} 个需要更新的交易对`);

            for (const symbol of fetchableSymbols) {
                try {
                    const ticker = await exchange.fetchTicker(symbol.symbol);
                    if (ticker && ticker.last) {
                        this.db.updatePrice(symbol.exchange, symbol.symbol, symbol.marketType, ticker.last);
                    }
                } catch (error) {
                    console.error(`获取 ${symbol.symbol} 价格时发生错误:`, error);
                    if (error instanceof BadSymbol) {
                        console.log(`将 ${symbol.symbol} 标记为不再获取`);
                        this.db.updateSymbol(symbol.exchange, symbol.symbol, symbol.marketType, 0);
                    }
                }
            }
            console.log(`${exchange.id} ${marketType} 价格同步完成`);
        } catch (error) {
            console.error(`同步 ${exchange.id} ${marketType} 价格时发生错误:`, error);
            throw error;
        }
    }

    public async startSync(): Promise<void> {
        if (this.isRunning) {
            console.log('同步服务已在运行中');
            return;
        }

        try {
            this.isRunning = true;
            console.log('启动同步服务...');

            // 初始同步
            console.log('执行初始同步...');
            for (const [exchangeId, exchange] of Object.entries(this.exchanges)) {
                await this.syncSymbols(exchange, 'spot').catch(error => {
                    console.error(`${exchangeId} spot 初始同步失败:`, error);
                });
                await this.syncSymbols(exchange, 'perpetual').catch(error => {
                    console.error(`${exchangeId} perpetual 初始同步失败:`, error);
                });
            }
            console.log('初始同步完成');

            // 设置定期同步
            console.log('设置定期同步...');
            this.syncInterval = setInterval(async () => {
                try {
                    for (const [exchangeId, exchange] of Object.entries(this.exchanges)) {
                        await this.syncPrices(exchange, 'spot').catch(error => {
                            console.error(`${exchangeId} spot 价格同步失败:`, error);
                        });
                        await this.syncPrices(exchange, 'perpetual').catch(error => {
                            console.error(`${exchangeId} perpetual 价格同步失败:`, error);
                        });
                    }
                } catch (error) {
                    console.error('执行定期同步时发生错误:', error);
                    if (error instanceof Error) {
                        console.error('错误堆栈:', error.stack);
                    }
                }
            }, 10000); // 每10秒同步一次
            console.log('定期同步已设置');

        } catch (error) {
            this.isRunning = false;
            console.error('启动同步服务时发生错误:', error);
            if (error instanceof Error) {
                console.error('错误堆栈:', error.stack);
            }
            throw error;
        }
    }

    public async stopSync(): Promise<void> {
        if (!this.isRunning) {
            console.log('同步服务未在运行');
            return;
        }

        try {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }

            this.isRunning = false;
            console.log('同步服务已停止');
        } catch (error) {
            console.error('停止同步服务时发生错误:', error);
            if (error instanceof Error) {
                console.error('错误堆栈:', error.stack);
            }
            throw error;
        }
    }
}

export default DataSyncService;

// CommonJS 兼容性支持
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataSyncService;
    module.exports.default = DataSyncService;
}
