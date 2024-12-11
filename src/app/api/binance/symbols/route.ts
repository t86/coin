import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';
const PROXY = 'http://127.0.0.1:7890';

export async function GET() {
    try {
        const url = `${BINANCE_API_URL}/exchangeInfo`;
        console.log('Fetching Binance symbols from:', url);

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
            console.error('Binance API error:', {
                status: response.status,
                statusText: response.statusText,
                url: url
            });
            return NextResponse.json(
                { error: `Binance API responded with status ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        if (!data.symbols) {
            return NextResponse.json(
                { error: 'Invalid response format' },
                { status: 500 }
            );
        }

        // 只返回状态为 TRADING 的 USDT 交易对
        const symbols = data.symbols
            .filter((item: any) => 
                item.status === 'TRADING' && 
                item.quoteAsset === 'USDT' &&
                item.isSpotTradingAllowed
            )
            .map((item: any) => ({
                symbol: item.symbol,
                baseAsset: item.baseAsset,
                quoteAsset: item.quoteAsset
            }));

        return NextResponse.json({ symbols });
    } catch (error) {
        console.error('Error fetching Binance symbols:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch symbols from Binance',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
