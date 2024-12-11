import { NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY = 'http://127.0.0.1:7890';
const BINANCE_SPOT_API_URL = 'https://api.binance.com/api/v3';
const BINANCE_FUTURES_API_URL = 'https://fapi.binance.com/fapi/v1';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('path');

        console.log('[Binance API] Request params:', {
            path,
            searchParams: Object.fromEntries(searchParams.entries())
        });

        if (!path) {
            return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
        }

        if (path === 'funding-rate') {
            const symbol = searchParams.get('symbol');
            if (!symbol) {
                return NextResponse.json(
                    { error: 'Symbol parameter is required for funding rate' },
                    { status: 400 }
                );
            }

            const url = `${BINANCE_FUTURES_API_URL}/funding-rate?symbol=${symbol}`;
            console.log('[Binance API] Requesting funding rate:', { url });

            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                httpsAgent: new HttpsProxyAgent(PROXY),
                timeout: 10000
            });

            console.log('[Binance API] Funding rate response:', {
                status: response.status,
                data: response.data
            });

            return NextResponse.json(response.data);
        } else {
            // 对于价格查询，直接转发到对应的 API
            const type = path.includes('fapi') ? 'perpetual' : 'spot';
            const baseUrl = type === 'perpetual' ? BINANCE_FUTURES_API_URL : BINANCE_SPOT_API_URL;
            const url = `${baseUrl}/${path}`;

            console.log('[Binance API] Requesting prices:', {
                url,
                type,
                baseUrl
            });

            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                httpsAgent: new HttpsProxyAgent(PROXY),
                timeout: 10000
            });

            console.log('[Binance API] Price response:', {
                status: response.status,
                dataLength: Array.isArray(response.data) ? response.data.length : 'not array'
            });

            return NextResponse.json(response.data);
        }
    } catch (error: any) {
        console.error('[Binance API] Error:', {
            message: error.message,
            response: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            },
            request: {
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers,
                params: error.config?.params
            }
        });

        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.response?.status || 500 }
        );
    }
}
