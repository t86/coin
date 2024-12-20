export interface PriceData {
    symbol: string;
    price: number;
    exchange: string;
    fundingRate?: number;
    nextFundingTime?: number;
}

export interface ExchangeSymbol {
    symbol: string;
    baseAsset?: string;
    quoteAsset?: string;
    exchange?: string;
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
