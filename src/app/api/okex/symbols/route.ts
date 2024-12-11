import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const OKEX_API_URL = 'https://www.okx.com/api/v5';
const PROXY = 'http://127.0.0.1:7890';

export async function GET() {
    try {
        const url = `${OKEX_API_URL}/market/tickers?instType=SPOT`;
        console.log('Fetching OKX symbols from:', url);

        const proxyAgent = new HttpsProxyAgent(PROXY);
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.okx.com/',
                'Origin': 'https://www.okx.com'
            },
            agent: proxyAgent,
            timeout: 10000
        });

        if (!response.ok) {
            console.error('OKX API error:', {
                status: response.status,
                statusText: response.statusText,
                url: url
            });
            return NextResponse.json(
                { error: `OKX API responded with status ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        if (!data.data) {
            return NextResponse.json(
                { error: 'Invalid response format' },
                { status: 500 }
            );
        }

        // 只返回USDT交易对
        const symbols = data.data
            .filter((item: any) => item.instId.endsWith('-USDT'))
            .map((item: any) => ({
                symbol: item.instId.replace('-', ''),
                baseAsset: item.instId.split('-')[0],
                quoteAsset: 'USDT'
            }));

        return NextResponse.json({ symbols });
    } catch (error) {
        console.error('Error fetching OKX symbols:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch symbols from OKX',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
