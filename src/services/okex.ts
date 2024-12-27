import ccxt from 'ccxt';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import { PriceData, ExchangeSymbol } from '../types/exchange';

// 缓存无效的交易对，避免重复请求
const invalidSymbolCache: { [key: string]: { timestamp: number, type: string } } = {};
const CACHE_EXPIRY = 1000 * 60 * 60; // 1小时后过期

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

class OkexService {
    private static instance: OkexService;
    private exchange: ccxt.okex;

    private constructor() {
        this.exchange = new ccxt.okx({
            enableRateLimit: true,
            timeout: 30000,  // 增加超时时间到30秒
            fetchImplementation: async (url: string, options = {}) => {
                const agent = new HttpsProxyAgent('http://127.0.0.1:7890');
                return fetch(url, { ...options, agent });
            }
        });
    }

    public static getInstance(): OkexService {
        if (!OkexService.instance) {
            OkexService.instance = new OkexService();
        }
        return OkexService.instance;
    }

    public static get name(): string {
        return 'OKEx';
    }

    public static async fetchFundingRate(symbol: string): Promise<{ fundingRate: string; nextFundingTime: number } | null> {
        return queueRequest(async () => {
            try {
                const perpSymbol = symbol.replace('USDT', '-USDT-SWAP');
                const fundingRate = await OkexService.getInstance().exchange.fetchFundingRate(perpSymbol);
                
                if (!fundingRate) {
                    return null;
                }

                return {
                    fundingRate: (fundingRate.fundingRate * 100).toFixed(4) + '%',
                    nextFundingTime: fundingRate.nextFundingTimestamp
                };
            } catch (error) {
                console.error(`Funding rate fetch error for ${symbol}:`, error);
                return null;
            }
        });
    }

    public static async fetchSinglePrice(symbol: string, type: 'spot' | 'perpetual'): Promise<PriceData | null> {
        return queueRequest(async () => {
            const cacheKey = `${symbol}-${type}`;
            const cachedInvalid = invalidSymbolCache[cacheKey];
            if (cachedInvalid && (Date.now() - cachedInvalid.timestamp) < CACHE_EXPIRY) {
                console.log(`Symbol ${symbol} is cached as invalid for type ${type}`);
                return null;
            }

            try {
                const formattedSymbol = type === 'perpetual'
                    ? symbol.replace('USDT', '-USDT-SWAP')  // 对于永续合约
                    : symbol.replace('USDT', '/USDT');      // 对于现货

                const ticker = await OkexService.getInstance().exchange.fetchTicker(formattedSymbol);
                console.log(`Fetched ticker for ${symbol}:`);
                
                // 检查 info 中的 lastPrice
                const lastPrice = ticker?.info?.last;
                if (!lastPrice || lastPrice === '0') {
                    throw new Error('No valid price data available');
                }

                const priceData: PriceData = {
                    symbol: symbol,
                    price: parseFloat(lastPrice),
                    timestamp: ticker.timestamp || Date.now(),
                    exchange: 'OKEx',
                    type: type
                };

                // 如果是永续合约，获取资金费率
                if (type === 'perpetual') {
                    const fundingInfo = await OkexService.fetchFundingRate(symbol);
                    console.log(`Fetched funding info for ${symbol}:`, fundingInfo);
                    if (fundingInfo) {
                        priceData.fundingRate = fundingInfo.fundingRate;
                        priceData.nextFundingTime = fundingInfo.nextFundingTime;
                    }
                }

                return priceData;
            } catch (error) {
                console.error(`Price fetch error for ${symbol}:`, error);
                invalidSymbolCache[cacheKey] = {
                    timestamp: Date.now(),
                    type
                };
                return null;
            }
        });
    }

    public static async fetchSymbols(type: 'spot' | 'perpetual' = 'spot'): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                console.log('Fetching markets with config:', OkexService.getInstance().exchange.options);
                const markets = await OkexService.getInstance().exchange.loadMarkets();
                console.log('Markets response received');
                return Object.values(markets)
                    .filter(market => {
                        if (type === 'perpetual') {
                            return market.swap && market.quote === 'USDT';
                        }
                        return market.spot && market.quote === 'USDT';
                    })
                    .map(market => ({
                        symbol: market.id.replace('-', ''),  // 移除连字符
                        baseAsset: market.base,
                        quoteAsset: market.quote,
                        marketType: type
                    }));
            } catch (error) {
                console.error('Error fetching symbols:', error);
                return [];
            }
        });
    }

    public static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return OkexService.fetchSymbols('spot');
    }

    public static async getPerpetualSymbols(): Promise<ExchangeSymbol[]> {
        return OkexService.fetchSymbols('perpetual');
    }
}

// 导出默认实例
export default OkexService;
