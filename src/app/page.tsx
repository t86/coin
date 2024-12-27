'use client';

import { useState, useEffect } from 'react';
import { PriceData } from '../types/exchange';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SymbolsConfig from "@/components/SymbolsConfig";
import PriceTable from "@/components/PriceTable";

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
        <main className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">加密货币价格</h1>
            <Tabs defaultValue="spot" className="w-full">
                <TabsList>
                    <TabsTrigger value="spot">现货</TabsTrigger>
                    <TabsTrigger value="perpetual">合约</TabsTrigger>
                    <TabsTrigger value="config">配置</TabsTrigger>
                </TabsList>
                <TabsContent value="spot">
                    <PriceTable marketType="spot" />
                </TabsContent>
                <TabsContent value="perpetual">
                    <PriceTable marketType="perpetual" />
                </TabsContent>
                <TabsContent value="config">
                    <SymbolsConfig />
                </TabsContent>
            </Tabs>
        </main>
    );
}
