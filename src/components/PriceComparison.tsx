import React from 'react';
import { CoinPriceComparison } from '../types/exchange';

interface PriceComparisonProps {
    data: CoinPriceComparison;
}

export const PriceComparison: React.FC<PriceComparisonProps> = ({ data }) => {
    const calculatePremium = (price: string, basePrice: string) => {
        const priceNum = Number(price);
        const basePriceNum = Number(basePrice);
        return ((priceNum - basePriceNum) / basePriceNum) * 100;
    };

    const formatPrice = (price?: string) => {
        if (!price) return '-';
        return Number(price).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        });
    };

    const formatPremium = (premium: number) => {
        return `${premium >= 0 ? '+' : ''}${premium.toFixed(3)}%`;
    };

    const getPremiumColor = (premium: number) => {
        if (premium > 0) return 'text-green-600';
        if (premium < 0) return 'text-red-600';
        return 'text-gray-600';
    };

    // 使用 Binance 作为基准价格
    const binancePrice = data.binance?.price;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="grid grid-cols-7 gap-4 items-center">
                {/* 币种名称 */}
                <div className="col-span-1">
                    <h3 className="text-lg font-bold text-gray-900">{data.symbol}</h3>
                </div>

                {/* Binance 价格 */}
                <div className="col-span-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">Binance</span>
                        <span className="text-base font-semibold">${formatPrice(data.binance?.price)}</span>
                    </div>
                </div>

                {/* OKEx 价格和溢价 */}
                <div className="col-span-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">OKEx</span>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">${formatPrice(data.okex?.price)}</span>
                            {binancePrice && data.okex?.price && (
                                <span className={`text-sm ${getPremiumColor(calculatePremium(data.okex.price, binancePrice))}`}>
                                    {formatPremium(calculatePremium(data.okex.price, binancePrice))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bybit 价格和溢价 */}
                <div className="col-span-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">Bybit</span>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">${formatPrice(data.bybit?.price)}</span>
                            {binancePrice && data.bybit?.price && (
                                <span className={`text-sm ${getPremiumColor(calculatePremium(data.bybit.price, binancePrice))}`}>
                                    {formatPremium(calculatePremium(data.bybit.price, binancePrice))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
