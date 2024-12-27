import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function PUT(request: NextRequest) {
    try {
        const { symbol, marketType, exchanges } = await request.json();
        const db = await getDatabase();
        
        // 获取现有的交易对信息
        const existingSymbols = await db.getSymbols(marketType);
        const existingSymbol = existingSymbols.find(s => s.symbol === symbol);
        
        if (!existingSymbol) {
            return NextResponse.json({ error: '交易对不存在' }, { status: 404 });
        }

        // 更新交易对的交易所支持情况
        await db.updateSymbols(marketType, [{
            ...existingSymbol,
            exchanges
        }]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating symbol:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
