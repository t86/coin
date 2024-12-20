import axios from 'axios';
import { PriceData, ExchangeSymbol } from '../types/exchange';

const API_BASE_URL = 'http://localhost:3000/api/okex';

// 缓存无效的交易对，避免重复请求
const invalidSymbolCache: { [key: string]: { timestamp: number, type: string } } = {};
const CACHE_EXPIRY = 1000 * 60 * 60; // 1小时后过期

// 限流机制
const requestQueue: Array<() => Promise<any>> = [];
let isProcessing = false;

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequests: 20,
    timeWindow: 1000, // 1 second
    requestDelay: 100 // ms between requests
};

let requestCount = 0;
let lastRequestTime = Date.now();

const resetRateLimit = () => {
    const now = Date.now();
    if (now - lastRequestTime >= RATE_LIMIT.timeWindow) {
        requestCount = 0;
        lastRequestTime = now;
    }
};

const waitForRateLimit = async () => {
    resetRateLimit();
    if (requestCount >= RATE_LIMIT.maxRequests) {
        const waitTime = RATE_LIMIT.timeWindow - (Date.now() - lastRequestTime);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        requestCount = 0;
    }
    requestCount++;
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.requestDelay));
};

// Axios instance with retry logic
const axiosInstance = axios.create({
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
    }
});

axiosInstance.interceptors.response.use(undefined, async (error) => {
    const config = error.config;
    config.retryCount = config.retryCount || 0;
    
    if (config.retryCount >= 3) {
        return Promise.reject(error);
    }
    
    config.retryCount += 1;
    
    // Exponential backoff
    const backoff = Math.pow(2, config.retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, backoff));
    
    return axiosInstance(config);
});

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

async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        requestQueue.push(async () => {
            try {
                await waitForRateLimit();
                const result = await fn();
                resolve(result);
            } catch (error) {
                console.error('[okex API] Request failed:', {
                    error: error.message,
                    config: error.config?.url,
                    status: error.response?.status,
                });
                reject(error);
            }
        });
        processQueue();
    });
}

class OkexService {
    static get name(): string {
        return 'okex';
    }

    static async fetchFundingRate(instrument: string): Promise<{ fundingRate: string; nextFundingTime: number } | null> {
        return queueRequest(async () => {
            try {
                const proxyParams = new URLSearchParams({
                    path: 'public/funding-rate',
                    params: `instId=${instrument}`
                });

                const response = await axiosInstance.get(`${API_BASE_URL}?${proxyParams.toString()}`);
                
                if (!response.data?.data?.[0]) {
                    return null;
                }

                const item = response.data.data[0];
                return {
                    fundingRate: (parseFloat(item.fundingRate) * 100).toFixed(4) + '%',
                    nextFundingTime: parseInt(item.nextFundingTime)
                };
            } catch (error) {
                console.error(`Funding rate fetch error for ${instrument}:`, error);
                return null;
            }
        });
    }

    static async fetchSinglePrice(instrument: string, type: 'spot' | 'perpetual'): Promise<PriceData | null> {
        return queueRequest(async () => {
            // 检查缓存中是否存在无效的交易对
            const cacheKey = `${instrument}-${type}`;
            const cachedInvalid = invalidSymbolCache[cacheKey];
            if (cachedInvalid && (Date.now() - cachedInvalid.timestamp) < CACHE_EXPIRY) {
                return null;
            }

            try {
                const instType = type === 'perpetual' ? 'SWAP' : 'SPOT';
                const proxyParams = new URLSearchParams({
                    path: 'market/ticker',
                    params: `instId=${instrument}&instType=${instType}`
                });

                const response = await axiosInstance.get(`${API_BASE_URL}?${proxyParams.toString()}`);
                
                // 处理各种可能的错误情况
                if (!response.data || response.data.error) {
                    console.error(`Price fetch error for ${instrument}:`, response.data);
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type
                    };
                    return null;
                }

                // 处理特定的错误码
                if (response.data.code === '51001') {
                    console.warn(`Instrument does not exist: ${instrument}`);
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type
                    };
                    return null;
                }

                // 确保数据存在
                if (!response.data.data?.[0]) {
                    console.warn(`No data for instrument: ${instrument}`);
                    return null;
                }

                const item = response.data.data[0];
                const priceData: PriceData = {
                    symbol: item.instId.replace('-', '').replace('-SWAP', ''),
                    price: item.last,
                    timestamp: Date.now(),
                    exchange: 'okex',
                    type
                };

                // 如果是永续合约，获取资金费率
                if (type === 'perpetual') {
                    const fundingInfo = await this.fetchFundingRate(instrument);
                    if (fundingInfo) {
                        priceData.fundingRate = fundingInfo.fundingRate;
                        priceData.nextFundingTime = fundingInfo.nextFundingTime;
                    }
                }

                return priceData;
            } catch (error) {
                console.error(`Price fetch error for ${instrument}:`, error);
                invalidSymbolCache[cacheKey] = {
                    timestamp: Date.now(),
                    type
                };
                return null;
            }
        });
    }

    static async fetchSymbols(type: 'spot' | 'perpetual' = 'perpetual'): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/symbols`, {
                    params: { type }
                });
                
                if (!response.data?.symbols) {
                    console.error('Invalid response format from okex symbols API:', response.data);
                    return [];
                }
                
                return response.data.symbols.map((symbol: any) => ({
                    ...symbol,
                    exchange: 'okex'
                }));
            } catch (error) {
                console.error('Error fetching okex symbols:', error);
                return [];
            }
        });
    }

    static async fetchPrices(type: 'spot' | 'perpetual' = 'perpetual'): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                const symbols = await this.fetchSymbols(type);
                const symbolNames = symbols.map(s => s.symbol);

                if (!symbolNames || symbolNames.length === 0) {
                    return [];
                }

                // 过滤掉已知无效的交易对
                const validSymbols = symbolNames.filter(symbol => {
                    const base = symbol.slice(0, -4);
                    const instrument = type === 'perpetual' ? `${base}-USDT-SWAP` : `${base}-USDT`;
                    const cacheKey = `${instrument}-${type}`;
                    const cachedInvalid = invalidSymbolCache[cacheKey];
                    return !cachedInvalid || (Date.now() - cachedInvalid.timestamp) >= CACHE_EXPIRY;
                });

                if (validSymbols.length === 0) {
                    return [];
                }

                // 转换交易对格式并获取价格
                const instruments = validSymbols.map(symbol => {
                    const base = symbol.slice(0, -4);
                    return type === 'perpetual' ? `${base}-USDT-SWAP` : `${base}-USDT`;
                });
                
                // 并行获取所有价格，但控制并发数
                const prices = await Promise.all(
                    instruments.map(inst => this.fetchSinglePrice(inst, type))
                );

                // 过滤掉失败的请求
                return prices.filter((price): price is PriceData => price !== null);
            } catch (error) {
                console.error('Error fetching okex prices:', error);
                return [];
            }
        });
    }

    static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'public/instruments',
                        instType: 'SPOT'
                    }
                });

                if (!response.data?.data) {
                    return [];
                }

                return response.data.data
                    .filter((symbol: any) => symbol.state === 'live')
                    .map((symbol: any) => ({
                        symbol: symbol.instId,
                        baseAsset: symbol.baseCcy,
                        quoteAsset: symbol.quoteCcy
                    }));
            } catch (error) {
                console.error('Error fetching spot symbols:', error);
                return [];
            }
        });
    }

    static async getPerpetualSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'public/instruments',
                        instType: 'SWAP'
                    }
                });

                if (!response.data?.data) {
                    return [];
                }

                return response.data.data
                    .filter((symbol: any) => symbol.state === 'live')
                    .map((symbol: any) => ({
                        symbol: symbol.instId,
                        baseAsset: symbol.baseCcy,
                        quoteAsset: symbol.quoteCcy
                    }));
            } catch (error) {
                console.error('Error fetching perpetual symbols:', error);
                return [];
            }
        });
    }

    static async getSpotPrices(): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/tickers',
                        instType: 'SPOT'
                    }
                });

                if (!response.data?.data) {
                    return [];
                }

                return response.data.data.map((item: any) => ({
                    symbol: item.instId,
                    price: item.last,
                    exchange: 'okex'
                }));
            } catch (error) {
                console.error('Error fetching spot prices:', error);
                return [];
            }
        });
    }

    static async getPerpetualPrices(): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                // 获取价格数据
                const priceResponse = await axiosInstance.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/tickers',
                        instType: 'SWAP'
                    }
                });

                if (!priceResponse.data?.data) {
                    return [];
                }

                // 获取资金费率数据
                const fundingResponse = await axiosInstance.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'public/funding-rate',
                        instType: 'SWAP'
                    }
                });

                const fundingRates = new Map(
                    fundingResponse.data?.data?.map((item: any) => [
                        item.instId,
                        {
                            fundingRate: parseFloat(item.fundingRate),
                            nextFundingTime: parseInt(item.nextFundingTime)
                        }
                    ]) || []
                );

                return priceResponse.data.data.map((item: any) => {
                    const fundingInfo = fundingRates.get(item.instId);
                    return {
                        symbol: item.instId,
                        price: parseFloat(item.last),
                        exchange: 'okex',
                        fundingRate: fundingInfo?.fundingRate,
                        nextFundingTime: fundingInfo?.nextFundingTime
                    };
                });
            } catch (error) {
                console.error('Error fetching perpetual prices:', error);
                return [];
            }
        });
    }
}

export default OkexService;
