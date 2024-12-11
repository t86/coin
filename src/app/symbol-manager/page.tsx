'use client';

import { useEffect, useState } from 'react';

export default function SymbolManagerPage() {
    const [symbols, setSymbols] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSymbols = async () => {
            try {
                const response = await fetch('/api/symbols?marketType=spot');
                const { data } = await response.json();
                setSymbols(data);
            } catch (error) {
                console.error('Error loading symbols:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSymbols();
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Symbol Manager</h1>
            
            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2 border">Standard Symbol</th>
                                <th className="px-4 py-2 border">Display Name</th>
                                <th className="px-4 py-2 border">Exchanges</th>
                                <th className="px-4 py-2 border">Original Symbols</th>
                            </tr>
                        </thead>
                        <tbody>
                            {symbols.map((symbol: any) => (
                                <tr key={symbol.symbol} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border">{symbol.symbol}</td>
                                    <td className="px-4 py-2 border">{symbol.displayName}</td>
                                    <td className="px-4 py-2 border">
                                        {symbol.exchanges?.join(', ') || '-'}
                                    </td>
                                    <td className="px-4 py-2 border">
                                        {symbol.originalSymbols?.join(', ') || symbol.symbol}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
