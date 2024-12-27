import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
    // 检查服务是否已初始化
    if (!global.__servicesInitialized) {
        return NextResponse.json(
            { status: 'error', message: 'Services are still initializing' },
            { status: 503 } // Service Unavailable
        );
    }

    const { searchParams } = new URL(request.url);
    const marketType = searchParams.get('marketType') || 'spot';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';

    try {
        // 获取数据库实例
        const db = await getDatabase();
        
        // 从缓存获取数据
        const symbols = db.getCachedSymbols(marketType as 'spot' | 'perpetual') || [];
        const prices = db.getCachedPrices(marketType as 'spot' | 'perpetual') || [];

        // 过滤并分页
        const filteredSymbols = symbols.filter(symbol => 
            symbol?.symbol?.toLowerCase().includes(search.toLowerCase())
        );

        const total = filteredSymbols.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedSymbols = filteredSymbols.slice(startIndex, endIndex);

        // 获取分页后的价格数据
        const paginatedData = paginatedSymbols.map(symbol => {
            const price = prices.find(p => p?.symbol === symbol?.symbol);
            return {
                symbol: symbol?.symbol || '',
                baseAsset: symbol?.baseAsset || '',
                quoteAsset: symbol?.quoteAsset || '',
                prices: {
                    binance: price?.binancePrice || null,
                    okex: price?.okexPrice || null,
                    bybit: price?.bybitPrice || null
                },
                fundingRates: marketType === 'perpetual' ? {
                    binance: price?.binanceFundingRate || null,
                    okex: price?.okexFundingRate || null,
                    bybit: price?.bybitFundingRate || null
                } : null
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                total,
                page,
                pageSize,
                symbols: paginatedSymbols,
                prices: paginatedData
            }
        });
    } catch (error) {
        console.error('Error fetching price data:', error);
        return NextResponse.json({
            success: false,
            data: {
                total: 0,
                page,
                pageSize,
                symbols: [],
                prices: []
            }
        });
    }
}
