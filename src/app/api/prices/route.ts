import { NextRequest } from 'next/server';
import { DatabaseManager } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const marketType = searchParams.get('marketType') || 'spot';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const db = await DatabaseManager.getInstance();

    // 获取总记录数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM prices p
      JOIN symbols s ON p.symbol = s.symbol AND p.market_type = s.market_type
      WHERE p.market_type = ? AND s.fetch = 1
    `;
    const { total } = db.get(countQuery, [marketType]);

    // 计算分页
    const offset = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // 获取分页数据
    const query = `
      SELECT p.*, s.base_asset as baseAsset, s.quote_asset as quoteAsset
      FROM prices p
      JOIN symbols s ON p.symbol = s.symbol AND p.market_type = s.market_type
      WHERE p.market_type = ? AND s.fetch = 1
      ORDER BY p.symbol ASC
      LIMIT ? OFFSET ?
    `;

    const prices = db.all(query, [marketType, pageSize, offset]);

    return Response.json({
      success: true,
      data: {
        prices: prices.map(price => ({
          symbol: price.symbol,
          baseAsset: price.baseAsset,
          quoteAsset: price.quoteAsset,
          prices: {
            binance: price.binance_price,
            okex: price.okex_price,
            bybit: price.bybit_price
          },
          fundingRateDiffs: marketType === 'perpetual' ? {
            binanceOkex: price.binance_funding_rate && price.okex_funding_rate ? 
              parseFloat(price.binance_funding_rate) - parseFloat(price.okex_funding_rate) : null,
            binanceBybit: price.binance_funding_rate && price.bybit_funding_rate ? 
              parseFloat(price.binance_funding_rate) - parseFloat(price.bybit_funding_rate) : null,
            okexBybit: price.okex_funding_rate && price.bybit_funding_rate ? 
              parseFloat(price.okex_funding_rate) - parseFloat(price.bybit_funding_rate) : null,
          } : null
        })),
        pagination: {
          total,
          page,
          pageSize,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return Response.json({ success: false, error: 'Failed to fetch prices' }, { status: 500 });
  }
}
