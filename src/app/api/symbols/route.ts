import { NextResponse } from 'next/server';
import DatabaseManager from '@/lib/database';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const marketType = searchParams.get('marketType') || 'spot';

    try {
        const symbols = await DatabaseManager.getSymbols(marketType as 'spot' | 'perpetual');
        return NextResponse.json({ data: symbols });
    } catch (error) {
        console.error('Error fetching symbols:', error);
        return NextResponse.json({ data: [] });
    }
}
