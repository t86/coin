const ccxt = require('ccxt');

interface ExchangeError {
    message?: string;
}

async function testExchanges() {
    try {
        // 基本配置
        const proxyUrl = 'http://127.0.0.1:7890' // 常用的代理端口
        const timeout = 30000; // 增加超时时间到30秒

        // 初始化交易所实例
        const binance = new ccxt.binance({
            timeout,
            proxy: proxyUrl,
            enableRateLimit: true,
        });

        const okx = new ccxt.okx({
            timeout,
            proxy: proxyUrl,
            enableRateLimit: true,
        });

        const bybit = new ccxt.bybit({
            timeout,
            proxy: proxyUrl,
            enableRateLimit: true,
        });

        // 测试Binance
        console.log('\n=== Testing Binance ===');
        try {
            // 获取现货市场
            const binanceSpotMarkets = await binance.loadMarkets();
            console.log('Binance Spot Markets Count:', Object.keys(binanceSpotMarkets).length);
            
            // 获取BTC/USDT的ticker数据
            const binanceBtcTicker = await binance.fetchTicker('BTC/USDT');
            console.log('Binance BTC/USDT Price:', binanceBtcTicker.last);

            // 获取合约市场数据
            const binanceFuturesMarkets = await binance.fetchMarkets('future');
            console.log('Binance Futures Markets Count:', binanceFuturesMarkets.length);
        } catch (error: unknown) {
            const err = error as ExchangeError;
            console.error('Binance Error:', err?.message || 'Unknown error');
        }

        // 测试OKX
        console.log('\n=== Testing OKX ===');
        try {
            // 获取现货市场
            const okxSpotMarkets = await okx.loadMarkets();
            console.log('OKX Spot Markets Count:', Object.keys(okxSpotMarkets).length);
            
            // 获取BTC/USDT的ticker数据
            const okxBtcTicker = await okx.fetchTicker('BTC/USDT');
            console.log('OKX BTC/USDT Price:', okxBtcTicker.last);

            // 获取合约市场数据
            const okxFuturesMarkets = await okx.fetchMarkets('swap');
            console.log('OKX Futures Markets Count:', okxFuturesMarkets.length);
        } catch (error: unknown) {
            const err = error as ExchangeError;
            console.error('OKX Error:', err?.message || 'Unknown error');
        }

        // 测试Bybit
        console.log('\n=== Testing Bybit ===');
        try {
            // 获取现货市场
            const bybitSpotMarkets = await bybit.loadMarkets();
            console.log('Bybit Spot Markets Count:', Object.keys(bybitSpotMarkets).length);
            
            // 获取BTC/USDT的ticker数据
            const bybitBtcTicker = await bybit.fetchTicker('BTC/USDT');
            console.log('Bybit BTC/USDT Price:', bybitBtcTicker.last);

            // 获取合约市场数据
            const bybitFuturesMarkets = await bybit.fetchMarkets('swap');
            console.log('Bybit Futures Markets Count:', bybitFuturesMarkets.length);
        } catch (error: unknown) {
            const err = error as ExchangeError;
            console.error('Bybit Error:', err?.message || 'Unknown error');
        }

    } catch (error: unknown) {
        const err = error as ExchangeError;
        console.error('General Error:', err?.message || 'Unknown error');
    }
}

// 运行测试
testExchanges().then(() => {
    console.log('\nTest completed');
}).catch((error: unknown) => {
    const err = error as ExchangeError;
    console.error('Test failed:', err?.message || 'Unknown error');
});
