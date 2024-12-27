import { NextResponse } from 'next/server';
import { ApiResponse, SymbolData } from '@/types/api';

export async function GET(): Promise<NextResponse<ApiResponse<SymbolData>>> {
    try {
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        const data = await response.json() as { symbols: any[] };
        
        if (!data.symbols) {
            return NextResponse.json({
                success: false,
                error: 'Invalid response format'
            });
        }

        const symbols = data.symbols
            .filter(item => 
                item.status === 'TRADING' && 
                item.quoteAsset === 'USDT' &&
                item.isSpotTradingAllowed
            )
            .map(item => ({
                symbol: item.symbol,
                baseAsset: item.baseAsset,
                quoteAsset: item.quoteAsset
            }));

        return NextResponse.json({
            success: true,
            data: { symbols }
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch symbols from Binance',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
