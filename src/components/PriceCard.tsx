import React from 'react';
import { PriceData } from '../types/exchange';

interface PriceCardProps {
    data: PriceData;
    fundingRates?: { [exchange: string]: number };
    fundingRateDiffs?: { [pair: string]: number };
}

export const PriceCard: React.FC<PriceCardProps> = ({ data, fundingRates, fundingRateDiffs }) => {
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

                {data.fundingRate !== undefined && (
                    <div className="border-t pt-2 mb-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">资金费率</span>
                            <span className={`text-sm font-semibold ${
                                data.fundingRate > 0 ? 'text-green-600' : 
                                data.fundingRate < 0 ? 'text-red-600' : 
                                'text-gray-600'
                            }`}>
                                {data.fundingRate === 0 ? '-' : 
                                 `${(data.fundingRate * 100).toFixed(4)}%`}
                            </span>
                        </div>
                        {data.nextFundingTime && (
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-sm text-gray-600">下次费率时间</span>
                                <span className="text-sm text-gray-600">
                                    {new Date(data.nextFundingTime).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {fundingRates && (
                    <>
                        <div className="border-t pt-2 mb-2">
                            <h4 className="text-sm font-semibold mb-2">资金费率</h4>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                {Object.entries(fundingRates).map(([exchange, rate]) => (
                                    <div key={exchange} className="text-center">
                                        <div className="text-sm text-gray-600 mb-1">{exchange}</div>
                                        <div className="font-medium">
                                            {rate ? `${(rate * 100).toFixed(4)}%` : '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {fundingRateDiffs && (
                            <div className="border-t pt-2">
                                <h4 className="text-sm font-semibold mb-2">资金费率差值</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    {Object.entries(fundingRateDiffs).map(([pair, diff]) => (
                                        <div key={pair} className="text-center">
                                            <div className="text-sm text-gray-600 mb-1">
                                                {pair.replace(/([A-Z])/g, '-$1').slice(1)}
                                            </div>
                                            <div className={`font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}`}>
                                                {diff ? `${(diff * 100).toFixed(4)}%` : '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
