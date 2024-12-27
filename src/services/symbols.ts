import BinanceService from './binance';
import BybitService from './bybit';
import OkexService from './okex';
import type { ExchangeSymbol } from '@/types/exchange';

export async function getAllSymbols(marketType: 'spot' | 'perpetual'): Promise<ExchangeSymbol[]> {
    try {
        const [binanceSymbols, bybitSymbols, okexSymbols] = await Promise.all([
            BinanceService.fetchSymbols(marketType),
            BybitService.fetchSymbols(marketType),
            OkexService.fetchSymbols(marketType)
        ]);

        // 合并所有交易所的交易对
        const symbolMap = new Map<string, ExchangeSymbol>();

        // 处理每个交易所的数据
        [
            { symbols: binanceSymbols, value: 1 },
            { symbols: bybitSymbols, value: 2 },
            { symbols: okexSymbols, value: 4 }
        ].forEach(({ symbols, value }) => {
            symbols.forEach(symbol => {
                const existing = symbolMap.get(symbol.symbol);
                if (existing) {
                    existing.exchanges |= value;
                } else {
                    symbolMap.set(symbol.symbol, { ...symbol, exchanges: value });
                }
            });
        });

        return Array.from(symbolMap.values());
    } catch (error) {
        console.error('Error fetching symbols:', error);
        return [];
    }
}
