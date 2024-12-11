import React from 'react';
import { PriceData } from '../types/exchange';

interface PriceCardProps {
    data: PriceData;
}

export const PriceCard: React.FC<PriceCardProps> = ({ data }) => {
    const getExchangeStyles = (exchange: string) => {
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
    };

    return (
        <div className="border-2 border-gray-200 bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className={`${getExchangeStyles(data.exchange)} text-white text-sm px-4 py-1.5 rounded-full font-semibold shadow-sm`}>
                        {data.exchange}
                    </span>
                    <h3 className="text-xl font-bold text-gray-800">{data.symbol}</h3>
                </div>
                
                <div className="flex flex-col gap-2">
                    <p className="text-4xl font-black text-gray-900 tracking-tight">
                        ${Number(data.price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4
                        })}
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-sm text-gray-600">
                            Updated: {new Date(data.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
