import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BYBIT_API_URL = 'https://api.bybit.com/v5';
const PROXY = 'http://127.0.0.1:7890';

export async function GET() {
    try {
        const url = `${BYBIT_API_URL}/market/instruments-info?category=spot`;
        console.log('Fetching Bybit symbols from:', url);

        const proxyAgent = new HttpsProxyAgent(PROXY);
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            agent: proxyAgent,
            timeout: 10000
        });

        if (!response.ok) {
            console.error('Bybit API error:', {
                status: response.status,
                statusText: response.statusText,
                url: url
            });
            return NextResponse.json(
                { error: `Bybit API responded with status ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        if (!data.result?.list) {
            return NextResponse.json(
                { error: 'Invalid response format' },
                { status: 500 }
            );
        }

        // 只返回状态为 TRADING 的 USDT 交易对
        const symbols = data.result.list
            .filter((item: any) => 
                item.status === 'Trading' && 
                item.quoteCoin === 'USDT'
            )
            .map((item: any) => ({
                symbol: item.symbol,
                baseAsset: item.baseCoin,
                quoteAsset: item.quoteCoin
            }));

        return NextResponse.json({ symbols });
    } catch (error) {
        console.error('Error fetching Bybit symbols:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch symbols from Bybit',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
