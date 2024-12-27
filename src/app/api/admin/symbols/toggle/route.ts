import { getDatabase } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { symbol, marketType, fetch } = await request.json();
    const db = await getDatabase();
    await db.updateSymbolFetch(symbol, marketType, fetch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling symbol:', error);
    return NextResponse.json({ error: 'Failed to toggle symbol' }, { status: 500 });
  }
} 