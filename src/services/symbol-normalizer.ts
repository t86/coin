export class SymbolNormalizer {
    // 移除常见的后缀，如 SWAP, PERP 等
    private static removeCommonSuffixes(symbol: string): string {
        return symbol.replace(/-?(SWAP|PERP|SPOT|USD-SWAP)$/, '');
    }

    // 移除分隔符
    private static removeDelimiters(symbol: string): string {
        return symbol.replace(/[-_/]/g, '');
    }

    // 从符号中提取基础资产和报价资产
    private static extractAssets(symbol: string): { baseAsset: string, quoteAsset: string } {
        // 移除后缀和分隔符
        const cleanSymbol = this.removeCommonSuffixes(symbol);
        
        // 常见的报价资产
        const quoteAssets = ['USDT', 'USD', 'BTC', 'ETH', 'BUSD'];
        
        for (const quote of quoteAssets) {
            if (cleanSymbol.endsWith(quote)) {
                const base = cleanSymbol.slice(0, -quote.length);
                return {
                    baseAsset: base,
                    quoteAsset: quote
                };
            }
        }

        // 如果没有找到匹配的报价资产，尝试在最后4个字符处分割
        return {
            baseAsset: cleanSymbol.slice(0, -4),
            quoteAsset: cleanSymbol.slice(-4)
        };
    }

    // 标准化交易对名称
    static normalize(symbol: string): string {
        let normalized = symbol.toUpperCase();
        normalized = this.removeCommonSuffixes(normalized);
        normalized = this.removeDelimiters(normalized);
        return normalized;
    }

    // 标准化交易对信息
    static normalizeSymbolInfo(symbol: any, exchange: string): any {
        const normalizedSymbol = this.normalize(symbol.symbol);
        const { baseAsset, quoteAsset } = this.extractAssets(symbol.symbol);
        
        return {
            ...symbol,
            normalizedSymbol,
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset || baseAsset,  // 优先使用原始数据中的baseAsset
            quoteAsset: symbol.quoteAsset || quoteAsset,  // 优先使用原始数据中的quoteAsset
            exchange
        };
    }
}
