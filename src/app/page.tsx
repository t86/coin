'use client';

import { useState, useEffect } from 'react';
import { PriceData } from '../types/exchange';

interface PriceResponse {
    success: boolean;
    data: {
        total: number;
        page: number;
        pageSize: number;
        symbols: Array<any>;
        prices: Array<{
            symbol: string;
            baseAsset: string;
            quoteAsset: string;
            prices: {
                binance: string | null;
                okex: string | null;
                bybit: string | null;
            };
            fundingRateDiffs?: {
                binanceOkex: number | null;
                binanceBybit: number | null;
                okexBybit: number | null;
            } | null;
        }>;
    };
}

export default function Home() {
    const [data, setData] = useState<PriceResponse | null>(null);
    const [marketType, setMarketType] = useState<'spot' | 'perpetual'>('spot');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPrices = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(
                `/api/prices?marketType=${marketType}&page=${currentPage}&pageSize=10&search=${searchQuery}`
            );
            if (!response.ok) {
                throw new Error('获取价格数据失败');
            }
            const newData = await response.json();
            if (!newData.success) {
                throw new Error(newData.message || '获取价格数据失败');
            }
            setData(newData);
        } catch (error) {
            console.error('Error fetching prices:', error);
            setError(error instanceof Error ? error.message : '获取价格数据失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        // 设置10秒刷新间隔
        const interval = setInterval(fetchPrices, 10000);
        return () => clearInterval(interval);
    }, [marketType, currentPage, searchQuery]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    return (
        <main className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">加密货币价格</h1>
            
            {/* 市场类型切换 */}
            <div className="flex mb-6 border-b border-gray-200">
                <button
                    className={`py-2 px-4 mr-4 font-medium text-sm ${
                        marketType === 'spot'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => {
                        setMarketType('spot');
                        setCurrentPage(1);
                    }}
                >
                    现货
                </button>
                <button
                    className={`py-2 px-4 font-medium text-sm ${
                        marketType === 'perpetual'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => {
                        setMarketType('perpetual');
                        setCurrentPage(1);
                    }}
                >
                    合约
                </button>
            </div>

            {/* 搜索框 */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="搜索交易对..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md w-64"
                />
            </div>

            {/* 自动刷新提示 */}
            <div className="flex justify-between mb-4">
                <div>
                    {error && (
                        <div className="text-red-500 text-sm">
                            {error}
                        </div>
                    )}
                </div>
                <span className="text-sm text-gray-500 flex items-center">
                    <div className={`w-2 h-2 ${loading ? 'bg-yellow-500' : 'bg-green-500'} rounded-full mr-2`}></div>
                    {loading ? '正在刷新...' : '每10秒自动刷新'}
                </span>
            </div>

            {/* 价格表格 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                交易对
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                基础/计价
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                交易所
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Binance
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                okex
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Bybit
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading && !data?.data?.prices && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-red-500">
                                    {error}
                                </td>
                            </tr>
                        )}
                        {!loading && !error && data?.data?.prices?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                    暂无数据
                                </td>
                            </tr>
                        )}
                        {!loading && !error && data?.data?.prices?.map((item, index) => (
                            <tr key={item.symbol} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.symbol}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.baseAsset}/{item.quoteAsset}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex space-x-2">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                                            Binance
                                        </span>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                                            Bybit
                                        </span>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                                            okex
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {item.prices.binance || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {item.prices.okex || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {item.prices.bybit || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 简化的分页控件 */}
            {data?.data && (
                <div className="mt-4 flex justify-center items-center space-x-4">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        className={`px-4 py-2 border rounded-md ${
                            currentPage === 1 || loading
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        上一页
                    </button>
                    <span className="text-sm text-gray-600">
                        第 {currentPage} 页 / 共 {Math.ceil(data.data.total / data.data.pageSize)} 页
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={loading || currentPage >= Math.ceil(data.data.total / data.data.pageSize)}
                        className={`px-4 py-2 border rounded-md ${
                            loading || currentPage >= Math.ceil(data.data.total / data.data.pageSize)
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        下一页
                    </button>
                </div>
            )}
        </main>
    );
}
