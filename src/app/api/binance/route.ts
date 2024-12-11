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
        const type = searchParams.get('type') || 'spot';

        console.log('[Binance API] Request params:', {
            path,
            type,
            searchParams: Object.fromEntries(searchParams.entries())
        });

        // 处理资金费率请求
        if (path === 'funding-rate') {
            const symbol = searchParams.get('symbol');
            if (!symbol) {
                return NextResponse.json(
                    { error: 'Symbol parameter is required for funding rate' },
                    { status: 400 }
                );
            }

            const url = `${BINANCE_FUTURES_API_URL}/fundingRate?symbol=${symbol}`;
            console.log('[Binance API] Requesting funding rate:', { url });

            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                httpsAgent: new HttpsProxyAgent(PROXY),
                timeout: 10000
            });

            return NextResponse.json(response.data);
        }
        
        // 处理价格请求
        if (!path) {
            // 如果没有指定路径，默认获取价格
            const baseUrl = type === 'perpetual' ? 'https://fapi.binance.com/fapi/v1' : 'https://api.binance.com/api/v3';
            const url = type === 'perpetual' ? `${baseUrl}/ticker/price` : `${baseUrl}/ticker/price`;

            console.log('[Binance API] Requesting prices:', { url, type });

            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                httpsAgent: new HttpsProxyAgent(PROXY),
                timeout: 10000
            });

            return NextResponse.json(response.data);
        }

        // 处理交易对信息请求
        if (type === 'perpetual') {
            const url = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
            console.log('[Binance API] Requesting perpetual exchange info:', { url });

            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                httpsAgent: new HttpsProxyAgent(PROXY),
                timeout: 10000
            });

            return NextResponse.json(response.data);
        }

        // 处理其他请求
        const baseUrl = type === 'perpetual' ? BINANCE_FUTURES_API_URL : BINANCE_SPOT_API_URL;
        const url = `${baseUrl}/${path}`;

        console.log('[Binance API] Making request:', { url, type });

        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            httpsAgent: new HttpsProxyAgent(PROXY),
            timeout: 10000
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('[Binance API] Error:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : 'No response',
            request: error.config ? {
                url: error.config.url,
                method: error.config.method,
                headers: error.config.headers,
                params: error.config.params
            } : 'No config'
        });

        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: error.response?.status || 500 }
        );
    }
}
