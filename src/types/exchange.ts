export interface PriceData {
    symbol: string;
    price: string;
    timestamp: number;
    exchange: string;
    type: 'spot' | 'perpetual';
    fundingRate?: string;      // 当前资金费率
    nextFundingTime?: string;  // 下次资金费率时间
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
