import axios from 'axios';
import { ExchangeSymbol, PriceData } from '../types/exchange';

const API_BASE_URL = 'http://localhost:3000/api/binance';

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

// 将现货交易对转换为合约交易对
function convertToPerpSymbol(symbol: string): string {
    // 例如：BTCUSDT -> BTCUSDT_PERP
    return `${symbol}_PERP`;
}

class BinanceService {
    static get name(): string {
        return 'Binance';
    }

    static async fetchFundingRate(symbol: string): Promise<{ fundingRate: string; nextFundingTime: number } | null> {
        return queueRequest(async () => {
            try {
                const proxyParams = new URLSearchParams({
                    path: 'funding-rate',
                    symbol: convertToPerpSymbol(symbol)
                });

                const response = await axios.get(`${API_BASE_URL}?${proxyParams.toString()}`);
                
                if (!response.data?.data?.[0]) {
                    return null;
                }

                const item = response.data.data[0];
                return {
                    fundingRate: (parseFloat(item.fundingRate) * 100).toFixed(4) + '%',
                    nextFundingTime: parseInt(item.nextFundingTime)
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
                console.log(`Symbol ${symbol} is cached as invalid for type ${type}`);
                return null;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        symbols: JSON.stringify([symbol.replace('_PERP', '')]),
                        type
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
                const priceItem = response.data[0];
                if (!priceItem || !priceItem.price) {
                    console.warn(`No data for symbol: ${symbol}`);
                    invalidSymbolCache[cacheKey] = {
                        timestamp: Date.now(),
                        type
                    };
                    return null;
                }

                console.log(`Successfully fetched price for ${symbol}: ${priceItem.price}`);

                const priceData: PriceData = {
                    symbol: symbol,
                    price: priceItem.price,
                    timestamp: Date.now(),
                    exchange: 'Binance',
                    type: priceItem.type || type
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
                    console.error('Invalid response format from Binance symbols API:', response.data);
                    return [];
                }
                
                return response.data.symbols.map((symbol: any) => ({
                    ...symbol,
                    exchange: 'binance'
                }));
            } catch (error) {
                console.error('Error fetching Binance symbols:', error);
                return [];
            }
        });
    }

    static async fetchPrices(
        type: 'spot' | 'perpetual' = 'spot',
        page: number = 1,
        pageSize: number = 10
    ): Promise<PriceData[]> {
        return queueRequest(async () => {
            try {
                const symbols = await this.fetchSymbols(type);
                
                // 分页处理
                const startIndex = (page - 1) * pageSize;
                const endIndex = startIndex + pageSize;
                const paginatedSymbols = symbols.slice(startIndex, endIndex);
                
                // 过滤掉已知无效的交易对
                const validSymbols = paginatedSymbols.filter(symbol => {
                    const cacheKey = `${symbol.symbol}-${type}`;
                    const cachedInvalid = invalidSymbolCache[cacheKey];
                    return !cachedInvalid || (Date.now() - cachedInvalid.timestamp) >= CACHE_EXPIRY;
                });

                if (validSymbols.length === 0) {
                    return [];
                }

                // 获取每个交易对的价格
                const symbolsToFetch = validSymbols.map(s => s.symbol);
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        symbols: JSON.stringify(symbolsToFetch),
                        type
                    }
                });

                if (!response.data || !Array.isArray(response.data)) {
                    console.error('Invalid response format:', response.data);
                    return [];
                }

                // 转换响应数据为PriceData格式
                return response.data
                    .filter((item: any) => item && item.price)
                    .map((item: any) => ({
                        symbol: type === 'perpetual' ? `${item.symbol}_PERP` : item.symbol,
                        price: item.price,
                        timestamp: Date.now(),
                        exchange: 'Binance',
                        type: item.type || type
                    }));

            } catch (error) {
                console.error('Error fetching Binance prices:', error);
                return [];
            }
        });
    }

    static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}`, {
                    params: {
                        path: 'exchangeInfo'
                    }
                });

                if (!response.data?.symbols) {
                    return [];
                }

                return response.data.symbols
                    .filter((symbol: any) => symbol.status === 'TRADING')
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        baseAsset: symbol.baseAsset,
                        quoteAsset: symbol.quoteAsset
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
                        path: 'fapi/v1/exchangeInfo'
                    }
                });

                if (!response.data?.symbols) {
                    return [];
                }

                return response.data.symbols
                    .filter((symbol: any) => symbol.status === 'TRADING')
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        baseAsset: symbol.baseAsset,
                        quoteAsset: symbol.quoteAsset
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
                        path: 'ticker/price'
                    }
                });

                if (!Array.isArray(response.data)) {
                    return [];
                }

                return response.data.map((item: any) => ({
                    symbol: item.symbol,
                    binancePrice: item.price,
                    okexPrice: null,
                    bybitPrice: null
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
                        path: 'fapi/v1/ticker/price'
                    }
                });

                if (!Array.isArray(response.data)) {
                    return [];
                }

                return response.data.map((item: any) => ({
                    symbol: item.symbol,
                    binancePrice: item.price,
                    okexPrice: null,
                    bybitPrice: null
                }));
            } catch (error) {
                console.error('Error fetching perpetual prices:', error);
                return [];
            }
        });
    }
}

export default BinanceService;
