declare module 'ccxt' {
  export interface Market {
    id: string;
    symbol: string;
    base: string;
    quote: string;
    spot?: boolean;
    swap?: boolean;
    future?: boolean;
    type?: string;
    active?: boolean;
    [key: string]: any;
  }

  export interface ExchangeOptions {
    enableRateLimit?: boolean;
    timeout?: number;
    proxy?: string;
    [key: string]: any;
  }

  export class Exchange {
    id: string;
    constructor(config?: ExchangeOptions);
    loadMarkets(): Promise<{ [key: string]: Market }>;
    fetchTicker(symbol: string): Promise<any>;
  }

  export class binance extends Exchange {}
  export class okex extends Exchange {}
  export class bybit extends Exchange {}
  export class okx extends Exchange {}

  export class BadSymbol extends Error {}

  const exchanges: string[];

  export default {
    exchanges,
    binance,
    okex,
    okx,
    bybit,
    BadSymbol
  };
} 