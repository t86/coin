import { NextResponse } from 'next/server';
import DatabaseManager from '@/lib/database';
import { initializeServices } from '@/lib/init-services';

// 初始化标志
let isInitialized = false;

export async function GET(request: Request) {
    // 确保服务只初始化一次
    if (!isInitialized) {
        await initializeServices();
        isInitialized = true;
    }

    const { searchParams } = new URL(request.url);
    const marketType = searchParams.get('marketType') || 'spot';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';

    try {
        // 获取数据
        const symbols = await DatabaseManager.getSymbols(marketType as 'spot' | 'perpetual') || [];
        const prices = await DatabaseManager.getPriceData(marketType as 'spot' | 'perpetual') || [];

        // 过滤并分页
        const filteredSymbols = symbols.filter(symbol => 
            symbol?.symbol?.toLowerCase().includes(search.toLowerCase())
        ) || [];

        const total = filteredSymbols.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedSymbols = filteredSymbols.slice(start, end);

        // 获取分页后的价格数据
        const paginatedData = paginatedSymbols.map(symbol => {
            const price = prices.find(p => p?.symbol === symbol?.symbol);
            console.log('price:', price);
            return {
                symbol: symbol?.symbol || '',
                baseAsset: symbol?.baseAsset || '',
                quoteAsset: symbol?.quoteAsset || '',
                prices: {
                    binance: price?.prices?.binance || null,
                    okex: price?.prices?.okex || null,
                    bybit: price?.prices?.bybit || null
                }
            };
        });

        // 确保返回有效的响应结构
        return NextResponse.json({
            data: paginatedData || [],
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            }
        });
    } catch (error) {
        console.error('Error fetching price data:', error);
        // 发生错误时返回空数据而不是错误状态
        return NextResponse.json({
            data: [],
            pagination: {
                total: 0,
                page: 1,
                pageSize,
                totalPages: 1
            }
        });
    }
}
