import ccxt from 'ccxt';
import { PriceData, ExchangeSymbol, FundingRateData } from '../types/exchange';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 缓存无效的交易对，避免重复请求
const invalidSymbolCache: { [key: string]: { timestamp: number, type: string } } = {};
const CACHE_EXPIRY = 3600000; // 1小时

// 限流机制
const requestQueue: Array<() => Promise<any>> = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (requestQueue.length > 0) {
        const request = requestQueue.shift();
        if (request) {
            try {
                await request();
                // 每个请求之间增加一个小的延迟，避免触发速率限制
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error('Queue request failed:', error);
            }
        }
    }

    isProcessing = false;
}

function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        requestQueue.push(async () => {
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
        processQueue();
    });
}

class BybitService {
    private static instance: BybitService;
    private exchange: ccxt.bybit;

    private constructor() {
        this.exchange = new ccxt.bybit({
            enableRateLimit: true,
            timeout: 30000,  // 增加超时时间到30秒
            options: {
                defaultType: 'spot'
            },
            fetchImplementation: async (url: string, options = {}) => {
                const agent = new HttpsProxyAgent('http://127.0.0.1:7890');
                return fetch(url, { ...options, agent });
            }
        });
    }

    public static getInstance(): BybitService {
        if (!BybitService.instance) {
            BybitService.instance = new BybitService();
        }
        return BybitService.instance;
    }

    public static get serviceName(): string {
        return 'Bybit';
    }

    public static async fetchFundingRate(symbol: string): Promise<{ fundingRate: string; nextFundingTime: number } | null> {
        return queueRequest(async () => {
            try {
                const perpSymbol = symbol.replace('USDT', ':USDT');
                const fundingRate = await BybitService.getInstance().exchange.fetchFundingRate(perpSymbol);

                if (!fundingRate || !fundingRate.fundingRate) {
                    return null;
                }

                return {
                    fundingRate: (fundingRate.fundingRate * 100).toFixed(4) + '%',
                    nextFundingTime: fundingRate.nextFundingTimestamp || 0
                };
            } catch (error) {
                console.error(`Funding rate fetch error for ${symbol}:`, error);
                return null;
            }
        });
    }

    public static async fetchSinglePrice(symbol: string, marketType: 'spot' | 'perpetual'): Promise<PriceData | null> {
        return queueRequest(async () => {
            try {
                const cacheKey = `${symbol}-${marketType}`;
                const cachedInvalid = invalidSymbolCache[cacheKey];
                if (cachedInvalid && Date.now() - cachedInvalid.timestamp < CACHE_EXPIRY) {
                    return null;
                }

                // 根据市场类型格式化交易对
                const formattedSymbol = marketType === 'perpetual'
                    ? symbol.replace('USDT', ':USDT')      // 对于永续合约
                    : symbol.replace('USDT', '/USDT');  // 对于现货

                const instance = BybitService.getInstance();
                if (!instance.exchange) {
                    throw new Error('Exchange not initialized');
                }

                const ticker = await instance.exchange.fetchTicker(formattedSymbol);
                
                if (!ticker || !ticker.last) {
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type: marketType
                    };
                    return null;
                }

                const priceData: PriceData = {
                    symbol,
                    price: ticker.last.toString(),
                    exchange: 'Bybit',
                    type: marketType,
                    timestamp: Date.now()
                };

                // 如果是永续合约，获取资金费率
                if (marketType === 'perpetual') {
                    const fundingInfo = await BybitService.fetchFundingRate(symbol);
                    if (fundingInfo) {
                        priceData.fundingRate = fundingInfo.fundingRate;
                        priceData.nextFundingTime = fundingInfo.nextFundingTime;
                    }
                }

                return priceData;

            } catch (error) {
                console.error(`Error fetching price for ${symbol}:`, error);
                return null;
            }
        });
    }

    public static async fetchSymbols(marketType: 'spot' | 'perpetual' = 'spot'): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const instance = BybitService.getInstance();
                instance.exchange.options.defaultType = marketType === 'perpetual' ? 'swap' : 'spot';
                
                const markets = await instance.exchange.loadMarkets();
                return Object.values(markets)
                    .filter(market => 
                        market.quote === 'USDT' && 
                        market.active && 
                        ((marketType === 'perpetual' && market.type === 'swap') || 
                         (marketType === 'spot' && market.type === 'spot'))
                    )
                    .map(market => ({
                        symbol: market.base + market.quote,
                        exchange: 'Bybit',
                        type: marketType
                    }));
            } catch (error) {
                console.error('Error fetching symbols:', error);
                return [];
            }
        });
    }

    public static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return BybitService.fetchSymbols('spot');
    }

    public static async getPerpetualSymbols(): Promise<ExchangeSymbol[]> {
        return BybitService.fetchSymbols('perpetual');
    }
}

export default BybitService;
