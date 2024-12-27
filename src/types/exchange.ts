export enum Exchange {
    Binance = 1,  // 0001
    OKEx = 2,     // 0010
    Bybit = 4     // 0100
}

export interface ExchangeSymbol {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    marketType: 'spot' | 'perpetual';
    exchanges: number;  // 使用位运算表示支持的交易所
}

export interface PriceData {
    symbol: string;
    price: number;
    exchange: string;
    timestamp: number;
    type: 'spot' | 'perpetual';
    fundingRate?: string;
    nextFundingTime?: number;
}

export interface ConsolidatedPriceData {
    symbol: string;
    prices: {
        binance: number | null;
        okex: number | null;
        bybit: number | null;
    };
    fundingRates?: {
        binance: number | null;
        okex: number | null;
        bybit: number | null;
    };
    fundingRateDiffs?: {
        binanceOkex: number | null;
        binanceBybit: number | null;
        okexBybit: number | null;
    };
}

export interface CoinPriceComparison {
    symbol: string;
    prices: PriceData[];
    timestamp: number;
}

export interface PremiumInfo {
    exchange: string;
    premium: number;
}

export interface ExchangeResponse {
    code: string;
    msg: string;
    data: any;
}

export interface TabOption {
    key: 'spot' | 'perpetual';
    label: string;
}
