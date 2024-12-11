import { SymbolInfo } from '@/types/common';

export class SymbolStandardizationService {
    // 标准化交易对名称
    static standardizeSymbolName(symbol: string): string {
        // 移除所有特殊字符，统一转换为大写
        return symbol.replace(/[-_/]/g, '').toUpperCase();
    }

    // 获取更易读的显示名称
    static getDisplayName(symbol: string): string {
        // 添加分隔符使其更易读，如 BTCUSDT -> BTC-USDT
        const standardized = this.standardizeSymbolName(symbol);
        // 常见的计价币
        const quoteCurrencies = ['USDT', 'BTC', 'ETH', 'USD'];
        
        for (const quote of quoteCurrencies) {
            if (standardized.endsWith(quote)) {
                return `${standardized.slice(0, -quote.length)}-${quote}`;
            }
        }
        
        // 如果没有找到明确的计价币，尝试在中间位置添加分隔符
        return standardized.length >= 6 
            ? `${standardized.slice(0, -4)}-${standardized.slice(-4)}`
            : standardized;
    }

    // 统一处理交易对信息
    static standardizeSymbolInfo(symbolInfo: SymbolInfo, exchange: string): SymbolInfo {
        const standardSymbol = this.standardizeSymbolName(symbolInfo.symbol);
        return {
            ...symbolInfo,
            symbol: standardSymbol,
            displayName: this.getDisplayName(standardSymbol),
            originalSymbol: symbolInfo.symbol,
            exchange,
        };
    }

    // 合并来自不同交易所的相同交易对信息
    static mergeSymbolInfos(symbolInfos: SymbolInfo[]): SymbolInfo[] {
        const symbolMap = new Map<string, SymbolInfo>();

        for (const info of symbolInfos) {
            const standardSymbol = this.standardizeSymbolName(info.symbol);
            const existing = symbolMap.get(standardSymbol);

            if (existing) {
                // 合并交易所信息
                symbolMap.set(standardSymbol, {
                    ...existing,
                    exchanges: [...(existing.exchanges || []), info.exchange],
                    originalSymbols: [...(existing.originalSymbols || []), info.originalSymbol],
                });
            } else {
                symbolMap.set(standardSymbol, {
                    ...info,
                    symbol: standardSymbol,
                    displayName: this.getDisplayName(standardSymbol),
                    exchanges: [info.exchange],
                    originalSymbols: [info.originalSymbol],
                });
            }
        }

        return Array.from(symbolMap.values());
    }
}
