import { NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const OKEX_API_URL = 'https://www.okx.com/api/v5';

const PROXY = 'http://127.0.0.1:7890';
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('path');
        const instType = searchParams.get('instType');

        console.log('[okex API] Request params:', {
            path,
            instType,
            searchParams: Object.fromEntries(searchParams.entries())
        });

        if (!path) {
            return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
        }

        const url = `${OKEX_API_URL}/${path}`;
        const params = new URLSearchParams();
        if (instType) {
            params.append('instType', instType);
        }

        console.log('[okex API] Making request:', {
            url,
            params: Object.fromEntries(params.entries())
        });

        const response = await axios.get(url, {
            params: Object.fromEntries(params),
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.okx.com/',
                'Origin': 'https://www.okx.com'
            },
            httpsAgent: new HttpsProxyAgent(PROXY),
            timeout: 10000
        });

        console.log('[okex API] Response:', {
            status: response.status,
            dataLength: response.data?.data?.length || 'no data array',
            data: response.data
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('[okex API] Error:', {
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
