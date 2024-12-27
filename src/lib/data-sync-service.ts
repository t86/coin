console.log('开始执行 data-sync-service.ts');

import ccxt, { Market, Exchange, BadSymbol } from 'ccxt';
import { DatabaseManager } from './database.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { fetch, ProxyAgent, Response, Headers } from 'undici';

console.log('导入模块完成');

// 创建一个 Response 类的模拟实现
class CustomResponse {
    public body: string;
    public status: number;
    public headers: Headers;

    constructor(body: string, status: number, headers: Headers) {
        this.body = body;
        this.status = status;
        this.headers = headers;
    }

    text() {
        return Promise.resolve(this.body);
    }

    json() {
        return Promise.resolve(JSON.parse(this.body));
    }
}

class DataSyncService {
    private static instance: DataSyncService | null = null;
    private db: DatabaseManager;
    private exchanges: { [key: string]: Exchange } = {};
    private isRunning: boolean = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private isSyncing: boolean = false;

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
                fetchImplementation: async (url: string, options: any = {}) => {
                    const response = await fetch(url, {
                        ...options,
                        dispatcher: proxyAgent
                    });
                    
                    const text = await response.text();
                    return new CustomResponse(
                        text,
                        response.status,
                        response.headers
                    );
                }
            };

            this.exchanges = {
                binance: new ccxt.binance(config),
                okex: new ccxt.okx(config),
                bybit: new ccxt.bybit(config)
            };

            // 测试连接
            for (const [name, exchange] of Object.entries(this.exchanges)) {
                try {
                    await exchange.loadMarkets();
                    console.log(`${name} 连接测试成功`);
                } catch (error) {
                    console.error(`${name} 连接测试失败:`, error);
                    throw error;
                }
            }

            console.log('所有交易所连接初始化完成');
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
                    symbol: market.id,
                    marketType,
                    base_asset: market.base,
                    quote_asset: market.quote,
                    exchanges: this.getExchangeValue(exchange.id)
                }));

            console.log(`发现 ${symbols.length} 个 ${marketType} 交易对`);
            for (const symbol of symbols) {
                try {
                    await this.updateSymbol(symbol);
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

    private getExchangeValue(exchangeId: string): number {
        switch (exchangeId.toLowerCase()) {
            case 'binance': return 1;
            case 'okex': case 'okx': return 2;
            case 'bybit': return 4;
            default: return 0;
        }
    }

    private async updateSymbol(symbolData: { 
        symbol: string; 
        marketType: string; 
        base_asset: string;
        quote_asset: string;
        exchanges: number;
    }): Promise<void> {
        const existingSymbol: any = await this.db.getSymbol(symbolData.symbol, symbolData.marketType);
        if (existingSymbol) {
            // 更新现有记录，合并 exchanges 位值
            symbolData.exchanges = existingSymbol.exchanges | symbolData.exchanges;
        }
        await this.db.updateSymbol(symbolData);
    }

    private async syncPrices(exchange: Exchange, marketType: string): Promise<void> {
        try {
            console.log(`正在同步 ${exchange.id} ${marketType} 价格...`);
            const symbols :any = await this.db.getSymbols(marketType);
            const fetchableSymbols = symbols.filter(s => s.fetch === 1);
            console.log(`找到 ${fetchableSymbols.length} 个需要更新的交易对`);

            for (const symbol of fetchableSymbols) {
                try {
                    const ticker = await exchange.fetchTicker(symbol.symbol);
                    if (ticker && ticker.last) {
                        const priceData = {
                            symbol: symbol.symbol,
                            marketType: symbol.marketType,
                            price: ticker.last,
                            exchangeId: exchange.id
                        };

                        if (marketType === 'perpetual') {
                            try {
                                const fundingInfo = await exchange.fetchFundingRate(symbol.symbol);
                                if (fundingInfo) {
                                    Object.assign(priceData, {
                                        fundingRate: fundingInfo.fundingRate,
                                        nextFundingTime: fundingInfo.nextFundingTimestamp
                                    });
                                }
                            } catch (error) {
                                console.error(`获取资金费率失败: ${symbol.symbol}`, error);
                            }
                        }

                        await this.db.updatePrice(priceData);
                        console.log(`更新 ${symbol.symbol} 价格成功`);
                    }
                } catch (error) {
                    console.error(`获取 ${symbol.symbol} 价格时发生错误:`, error);
                    // if (error instanceof BadSymbol) {
                    //     console.log(`将 ${symbol.symbol} 标记为不再获取`);
                    //     await this.db.updateSymbolFetch(symbol.symbol, symbol.marketType, 0);
                    // }
                }
            }
            console.log(`${exchange.id} ${marketType} 价格同步完成`);
        } catch (error) {
            console.error(`同步 ${exchange.id} ${marketType} 价格时发生错误:`, error);
            throw error;
        }
    }

    private async executeSyncTask() {
        if (this.isSyncing) {
            console.log('上一次同步任务还在进行中，跳过本次同步');
            return;
        }
        
        try {
            this.isSyncing = true;
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
        } finally {
            this.isSyncing = false;
            console.log('同步任务完成');
        }
    }

    public async startSync(): Promise<void> {
        if (this.isRunning) {
            console.log('同步服务已在运行');
            return;
        }

        try {
            this.isRunning = true;
            console.log('设置定期同步...');
            // 立即执行一次同步
            await this.executeSyncTask();

            // 设置定期执行
            this.syncInterval = setInterval(() => {
                this.executeSyncTask().catch(error => {
                    console.error('定期同步任务执行失败:', error);
                });
            }, 10000); // 每10秒同步一次

            console.log('同步服务已启动');
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
