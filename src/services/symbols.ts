import { getBinanceSymbols } from './binance';
import { getBybitSymbols } from './bybit';
import { getOkexSymbols } from './okex';
import { withCache } from './cache';

export interface Symbol {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    exchanges: string[];
}

interface SymbolMap {
    [key: string]: Symbol;
}

// 缓存键
const CACHE_KEYS = {
    ALL_SYMBOLS: 'all_symbols',
    BINANCE_SYMBOLS: 'binance_symbols',
    BYBIT_SYMBOLS: 'bybit_symbols',
    OKEX_SYMBOLS: 'okex_symbols',
    COMMON_BASE_ASSETS: 'common_base_assets'
};

// 缓存时间
const CACHE_TTL = {
    SYMBOLS: 5 * 60 * 1000,  // 5分钟
    BASE_ASSETS: 10 * 60 * 1000  // 10分钟
};

export async function getAllSymbols(minExchanges: number = 1): Promise<Symbol[]> {
    return withCache(
        `${CACHE_KEYS.ALL_SYMBOLS}_${minExchanges}`,
        async () => {
            try {
                // 并行获取所有交易所的交易对
                const [binanceSymbols, bybitSymbols, okexSymbols] = await Promise.all([
                    withCache(CACHE_KEYS.BINANCE_SYMBOLS, getBinanceSymbols, { ttl: CACHE_TTL.SYMBOLS }),
                    withCache(CACHE_KEYS.BYBIT_SYMBOLS, getBybitSymbols, { ttl: CACHE_TTL.SYMBOLS }),
                    withCache(CACHE_KEYS.OKEX_SYMBOLS, getOkexSymbols, { ttl: CACHE_TTL.SYMBOLS })
                ]);

                // 创建一个映射来合并相同的交易对
                const symbolMap: SymbolMap = {};

                // 处理 Binance 交易对
                binanceSymbols.forEach(symbol => {
                    symbolMap[symbol.symbol] = {
                        ...symbol,
                        exchanges: ['Binance']
                    };
                });

                // 处理 Bybit 交易对
                bybitSymbols.forEach(symbol => {
                    if (symbolMap[symbol.symbol]) {
                        symbolMap[symbol.symbol].exchanges.push('Bybit');
                    } else {
                        symbolMap[symbol.symbol] = {
                            ...symbol,
                            exchanges: ['Bybit']
                        };
                    }
                });

                // 处理 OKEx 交易对
                okexSymbols.forEach(symbol => {
                    if (symbolMap[symbol.symbol]) {
                        symbolMap[symbol.symbol].exchanges.push('OKEx');
                    } else {
                        symbolMap[symbol.symbol] = {
                            ...symbol,
                            exchanges: ['OKEx']
                        };
                    }
                });

                // 过滤和排序
                return Object.values(symbolMap)
                    // 过滤掉不在足够交易所上市的交易对
                    .filter(symbol => symbol.exchanges.length >= minExchanges)
                    // 按以下优先级排序：
                    // 1. 交易所数量（降序）
                    // 2. 符号名称（升序）
                    .sort((a, b) => {
                        // 首先按交易所数量排序
                        const exchangeDiff = b.exchanges.length - a.exchanges.length;
                        if (exchangeDiff !== 0) {
                            return exchangeDiff;
                        }
                        // 如果交易所数量相同，按符号名称排序
                        return a.symbol.localeCompare(b.symbol);
                    });
            } catch (error) {
                console.error('Error fetching all symbols:', error);
                return [];
            }
        },
        { ttl: CACHE_TTL.SYMBOLS }
    );
}

export function filterSymbols(
    symbols: Symbol[],
    options: {
        minExchanges?: number;
        exchanges?: string[];
        search?: string;
        baseAssets?: string[];
    } = {}
): Symbol[] {
    const {
        minExchanges = 1,
        exchanges = [],
        search = '',
        baseAssets = []
    } = options;

    return symbols.filter(symbol => {
        // 检查最小交易所数量
        if (symbol.exchanges.length < minExchanges) {
            return false;
        }

        // 检查指定交易所
        if (exchanges.length > 0 && !exchanges.every(e => symbol.exchanges.includes(e))) {
            return false;
        }

        // 检查基础资产
        if (baseAssets.length > 0 && !baseAssets.includes(symbol.baseAsset)) {
            return false;
        }

        // 检查搜索词
        if (search && !symbol.symbol.toLowerCase().includes(search.toLowerCase())) {
            return false;
        }

        return true;
    });
}

export async function getCommonBaseAssets(symbols: Symbol[]): Promise<string[]> {
    return withCache(
        CACHE_KEYS.COMMON_BASE_ASSETS,
        async () => {
            // 创建一个映射来统计每个基础资产的出现次数
            const baseAssetCount = new Map<string, number>();
            
            symbols.forEach(symbol => {
                const count = baseAssetCount.get(symbol.baseAsset) || 0;
                baseAssetCount.set(symbol.baseAsset, count + 1);
            });

            // 按出现次数降序排序，返回基础资产列表
            return Array.from(baseAssetCount.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([asset]) => asset);
        },
        { ttl: CACHE_TTL.BASE_ASSETS }
    );
}
