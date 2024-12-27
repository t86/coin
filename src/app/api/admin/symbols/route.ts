import { NextRequest } from 'next/server';
import { DatabaseManager } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const marketType = searchParams.get('marketType') || 'spot';
    const search = searchParams.get('search') || '';
    const baseAsset = searchParams.get('baseAsset');
    const quoteAsset = searchParams.get('quoteAsset');

    const db = await DatabaseManager.getInstance();

    let query = `
      SELECT * FROM symbols 
      WHERE market_type = ?
    `;
    const params: any[] = [marketType];

    if (search) {
      query += ` AND symbol LIKE ?`;
      params.push(`%${search}%`);
    }

    if (baseAsset && baseAsset !== 'all') {
      query += ` AND base_asset = ?`;
      params.push(baseAsset);
    }

    if (quoteAsset && quoteAsset !== 'all') {
      query += ` AND quote_asset = ?`;
      params.push(quoteAsset);
    }

    query += ` ORDER BY symbol ASC`;

    const symbols = db.all(query, params);

    return Response.json(symbols.map(symbol => ({
      symbol: symbol.symbol,
      marketType: symbol.market_type,
      baseAsset: symbol.base_asset,
      quoteAsset: symbol.quote_asset,
      exchanges: symbol.exchanges,
      fetch: symbol.fetch
    })));
  } catch (error) {
    console.error('Error fetching symbols:', error);
    return Response.json({ success: false, error: 'Failed to fetch symbols' }, { status: 500 });
  }
}
