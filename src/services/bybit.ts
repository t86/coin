import axios from 'axios';
import { PriceData, ExchangeSymbol } from '../types/exchange';

const API_BASE_URL = 'http://localhost:3000/api/bybit';

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

class BybitService {
    static get name(): string {
        return 'Bybit';
    }

    static async fetchFundingRate(symbol: string): Promise<{ fundingRate: string; nextFundingTime: string } | null> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/market/tickers`, {
                    params: {
                        category: 'linear',
                        symbol
                    }
                });

                if (!response.data?.result?.list?.[0]) {
                    return null;
                }

                const item = response.data.result.list[0];
                console.log('Bybit funding time raw data:', {
                    symbol,
                    nextFundingTime: item.nextFundingTime,
                    type: typeof item.nextFundingTime
                });
                
                // Bybit API returns timestamp in seconds, need to convert to milliseconds
                const timestamp = typeof item.nextFundingTime === 'string' 
                    ? parseInt(item.nextFundingTime) * 1000 
                    : item.nextFundingTime * 1000;
                    
                const date = new Date(timestamp);
                console.log('Converted date:', date.toISOString());
                
                const nextFundingTime = date.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                
                return {
                    fundingRate: (parseFloat(item.fundingRate) * 100).toFixed(4) + '%',
                    nextFundingTime
                };
            } catch (error) {
                console.error(`Funding rate fetch error for ${symbol}:`, error);
                return null;
            }
        });
    }

    static async fetchSinglePrice(symbol: string, type: 'spot' | 'perpetual'): Promise<PriceData | null> {
        return queueRequest(async () => {
            // 检查缓存中是否存在无效的交易对
            const cacheKey = `${symbol}-${type}`;
            const cachedInvalid = invalidSymbolCache[cacheKey];
            if (cachedInvalid && (Date.now() - cachedInvalid.timestamp) < CACHE_EXPIRY) {
                return null;
            }

            try {
                const category = type === 'perpetual' ? 'linear' : 'spot';
                const response = await axios.get(`${API_BASE_URL}/market/tickers`, {
                    params: {
                        category,
                        symbol
                    }
                });

                // 处理各种可能的错误情况
                if (!response.data || response.data.error) {
                    console.error(`Price fetch error for ${symbol}:`, response.data);
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type
                    };
                    return null;
                }

                // 确保数据存在
                if (!response.data.result?.list?.[0]) {
                    console.warn(`No data for symbol: ${symbol}`);
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type
                    };
                    return null;
                }

                const item = response.data.result.list[0];
                const priceData: PriceData = {
                    symbol: item.symbol,
                    price: item.lastPrice,
                    timestamp: Date.now(),
                    exchange: 'Bybit',
                    type
                };

                // 如果是永续合约，获取资金费率
                if (type === 'perpetual') {
                    const fundingInfo = await this.fetchFundingRate(symbol);
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

    static async fetchSymbols(type: 'spot' | 'perpetual' = 'spot'): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/symbols`, {
                    params: { type }
                });
                
                if (!response.data?.symbols) {
                    console.error('Invalid response format from Bybit symbols API:', response.data);
                    return [];
                }
                
                return response.data.symbols.map((symbol: any) => ({
                    ...symbol,
                    exchange: 'bybit'
                }));
            } catch (error) {
                console.error('Error fetching Bybit symbols:', error);
                return [];
            }
        });
    }

    static async fetchPrices(type: 'spot' | 'perpetual' = 'spot'): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                const symbols = await this.fetchSymbols(type);
                const symbolNames = symbols.map(s => s.symbol);

                if (!symbolNames || symbolNames.length === 0) {
                    return [];
                }

                // 过滤掉已知无效的交易对
                const validSymbols = symbolNames.filter(symbol => {
                    const cacheKey = `${symbol}-${type}`;
                    const cachedInvalid = invalidSymbolCache[cacheKey];
                    return !cachedInvalid || (Date.now() - cachedInvalid.timestamp) >= CACHE_EXPIRY;
                });

                if (validSymbols.length === 0) {
                    return [];
                }

                const category = type === 'perpetual' ? 'linear' : 'spot';
                const response = await axios.get(`${API_BASE_URL}/market/tickers`, {
                    params: {
                        category
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                const prices = response.data.result.list.filter((item: any) => 
                    validSymbols.includes(item.symbol)
                );

                // 更新缓存：将不在返回数据中的交易对标记为无效
                const returnedSymbols = new Set(prices.map((item: any) => item.symbol));
                validSymbols.forEach(symbol => {
                    if (!returnedSymbols.has(symbol)) {
                        invalidSymbolCache[`${symbol}-${type}`] = {
                            timestamp: Date.now(),
                            type
                        };
                    }
                });

                // 获取价格数据
                const pricePromises = prices.map(async (item: any) => {
                    const priceData: PriceData = {
                        symbol: item.symbol,
                        price: item.lastPrice,
                        timestamp: Date.now(),
                        exchange: 'Bybit',
                        type
                    };

                    // 如果是永续合约，获取资金费率
                    if (type === 'perpetual') {
                        const fundingInfo = await this.fetchFundingRate(item.symbol);
                        if (fundingInfo) {
                            priceData.fundingRate = fundingInfo.fundingRate;
                            priceData.nextFundingTime = fundingInfo.nextFundingTime;
                        }
                    }

                    return priceData;
                });

                return Promise.all(pricePromises);
            } catch (error) {
                console.error('Error fetching Bybit prices:', error);
                return [];
            }
        });
    }

    static async getBybitSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/market/tickers`, {
                    params: {
                        category: 'spot'
                    }
                });
                
                const symbols = response.data.result.list.map((item: any) => ({
                    symbol: item.symbol,
                    baseAsset: item.baseCoin,
                    quoteAsset: item.quoteCoin
                }));
                
                return symbols;
            } catch (error) {
                console.error('Error fetching Bybit symbols:', error);
                return [];
            }
        });
    }

    static async getBybitPrices(symbols: string[], type: 'spot' | 'perpetual' = 'spot'): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                // 过滤掉已知无效的交易对
                const validSymbols = symbols.filter(symbol => {
                    const cacheKey = `${symbol}-${type}`;
                    const cachedInvalid = invalidSymbolCache[cacheKey];
                    return !cachedInvalid || (Date.now() - cachedInvalid.timestamp) >= CACHE_EXPIRY;
                });

                if (validSymbols.length === 0) {
                    return [];
                }

                const category = type === 'perpetual' ? 'linear' : 'spot';
                const response = await axios.get(`${API_BASE_URL}/market/tickers`, {
                    params: {
                        category
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                const prices = response.data.result.list.filter((item: any) => 
                    validSymbols.includes(item.symbol)
                );

                // 更新缓存：将不在返回数据中的交易对标记为无效
                const returnedSymbols = new Set(prices.map((item: any) => item.symbol));
                validSymbols.forEach(symbol => {
                    if (!returnedSymbols.has(symbol)) {
                        invalidSymbolCache[`${symbol}-${type}`] = {
                            timestamp: Date.now(),
                            type
                        };
                    }
                });

                // 获取价格数据
                const pricePromises = prices.map(async (item: any) => {
                    const priceData: PriceData = {
                        symbol: item.symbol,
                        price: item.lastPrice,
                        timestamp: Date.now(),
                        exchange: 'Bybit',
                        type
                    };

                    // 如果是永续合约，获取资金费率
                    if (type === 'perpetual') {
                        const fundingInfo = await this.fetchFundingRate(item.symbol);
                        if (fundingInfo) {
                            priceData.fundingRate = fundingInfo.fundingRate;
                            priceData.nextFundingTime = fundingInfo.nextFundingTime;
                        }
                    }

                    return priceData;
                });

                return Promise.all(pricePromises);
            } catch (error) {
                console.error('Error fetching Bybit prices:', error);
                // 发生错误时，将所有交易对标记为无效
                symbols.forEach(symbol => {
                    invalidSymbolCache[`${symbol}-${type}`] = {
                        timestamp: Date.now(),
                        type
                    };
                });
                return [];
            }
        });
    }

    static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/instruments-info',
                        category: 'spot'
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                return response.data.result.list
                    .filter((symbol: any) => symbol.status === 'Trading')
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        baseAsset: symbol.baseCoin,
                        quoteAsset: symbol.quoteCoin
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
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/instruments-info',
                        category: 'linear'
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                return response.data.result.list
                    .filter((symbol: any) => symbol.status === 'Trading')
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        baseAsset: symbol.baseCoin,
                        quoteAsset: symbol.quoteCoin
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
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/tickers',
                        category: 'spot'
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                return response.data.result.list.map((item: any) => ({
                    symbol: item.symbol,
                    binancePrice: null,
                    okexPrice: null,
                    bybitPrice: item.lastPrice
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
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'market/tickers',
                        category: 'linear'
                    }
                });

                if (!response.data?.result?.list) {
                    return [];
                }

                return response.data.result.list.map((item: any) => ({
                    symbol: item.symbol,
                    binancePrice: null,
                    okexPrice: null,
                    bybitPrice: item.lastPrice
                }));
            } catch (error) {
                console.error('Error fetching perpetual prices:', error);
                return [];
            }
        });
    }
}

export default BybitService;
