import React from 'react';
import { PriceData } from '@/types/exchange';

interface PriceCardProps {
    data: PriceData;
}

function getExchangeStyles(exchange: string): string {
    switch (exchange.toLowerCase()) {
        case 'binance':
            return 'bg-yellow-500 border-yellow-600';
        case 'okex':
            return 'bg-blue-500 border-blue-600';
        case 'bybit':
            return 'bg-purple-500 border-purple-600';
        default:
            return 'bg-gray-500 border-gray-600';
    }
}

export function PriceCard({ data }: PriceCardProps) {
    const fundingRateValue = data.fundingRate ? parseFloat(data.fundingRate) : 0;
    
    return (
        <div className="border-2 border-gray-200 bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className={`${getExchangeStyles(data.exchange)} text-white text-sm px-4 py-1.5 rounded-full`}>
                        {data.exchange}
                    </span>
                    <h3 className="text-xl font-bold">{data.symbol}</h3>
                </div>
                
                {data.fundingRate && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">资金费率</span>
                        <span className={`text-sm font-semibold ${
                            fundingRateValue > 0 ? 'text-green-600' : 
                            fundingRateValue < 0 ? 'text-red-600' : 
                            'text-gray-600'
                        }`}>
                            {fundingRateValue === 0 ? '-' : data.fundingRate}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
