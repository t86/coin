import { NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BYBIT_API_URL = 'https://api.bybit.com/v5';

const PROXY = 'http://127.0.0.1:7890';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('path');
        const category = searchParams.get('category');

        console.log('[Bybit API] Request params:', {
            path,
            category,
            searchParams: Object.fromEntries(searchParams.entries())
        });

        if (!path) {
            return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
        }

        const url = `${BYBIT_API_URL}/${path}`;
        const params = new URLSearchParams();
        if (category) {
            params.append('category', category);
        }

        console.log('[Bybit API] Making request:', {
            url,
            params: Object.fromEntries(params.entries())
        });

        const response = await axios.get(url, {
            params: Object.fromEntries(params),
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            httpsAgent: new HttpsProxyAgent(PROXY),
            timeout: 10000
        });

        console.log('[Bybit API] Response:', {
            status: response.status,
            dataLength: response.data?.result?.list?.length || 'no list data',
            data: response.data
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('[Bybit API] Error:', {
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
