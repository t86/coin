export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface PaginationParams {
    page: number;
    pageSize: number;
}

export interface SymbolData {
    symbols: Array<{
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
    }>;
} 