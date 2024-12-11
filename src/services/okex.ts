import axios from 'axios';
import { PriceData, ExchangeSymbol } from '../types/exchange';

const API_BASE_URL = 'http://localhost:3000/api/okex';

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
    static get name(): string {
        return 'OKEx';
    }

    static async fetchFundingRate(instrument: string): Promise<{ fundingRate: string; nextFundingTime: number } | null> {
        return queueRequest(async () => {
            try {
                const proxyParams = new URLSearchParams({
                    path: 'public/funding-rate',
                    params: `instId=${instrument}`
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

                const response = await axios.get(`${API_BASE_URL}?${proxyParams.toString()}`);
                
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
                    exchange: 'OKEx',
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
                const response = await axios.get(`${API_BASE_URL}/symbols`, {
                    params: { type }
                });
                
                if (!response.data?.symbols) {
                    console.error('Invalid response format from OKEx symbols API:', response.data);
                    return [];
                }
                
                return response.data.symbols.map((symbol: any) => ({
                    ...symbol,
                    exchange: 'okex'
                }));
            } catch (error) {
                console.error('Error fetching OKEx symbols:', error);
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
                console.error('Error fetching OKEx prices:', error);
                return [];
            }
        });
    }

    static async getSpotSymbols(): Promise<ExchangeSymbol[]> {
        return queueRequest(async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}`, {
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
                const response = await axios.get(`${API_BASE_URL}`, {
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
                const response = await axios.get(`${API_BASE_URL}`, {
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
                    binancePrice: null,
                    okexPrice: item.last,
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
                        path: 'market/tickers',
                        instType: 'SWAP'
                    }
                });

                if (!response.data?.data) {
                    return [];
                }

                return response.data.data.map((item: any) => ({
                    symbol: item.instId,
                    binancePrice: null,
                    okexPrice: item.last,
                    bybitPrice: null
                }));
            } catch (error) {
                console.error('Error fetching perpetual prices:', error);
                return [];
            }
        });
    }
}

export default OkexService;
