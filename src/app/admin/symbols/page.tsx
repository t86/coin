import { ExchangeSymbol, Exchange } from '@/types/exchange';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

async function getSymbols() {
    const db = await getDatabase();
    const spotSymbols = await db.getSymbols('spot');
    const perpetualSymbols = await db.getSymbols('perpetual');
    return { spotSymbols, perpetualSymbols };
}

export default async function AdminSymbolsPage() {
    const { spotSymbols, perpetualSymbols } = await getSymbols();

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">交易对管理</h1>
            
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">现货交易对</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2 border">交易对</th>
                                <th className="px-4 py-2 border">基础资产</th>
                                <th className="px-4 py-2 border">计价资产</th>
                                <th className="px-4 py-2 border">Binance</th>
                                <th className="px-4 py-2 border">OKEx</th>
                                <th className="px-4 py-2 border">Bybit</th>
                                <th className="px-4 py-2 border">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {spotSymbols.map((symbol: ExchangeSymbol) => (
                                <tr key={symbol.symbol} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border">{symbol.symbol}</td>
                                    <td className="px-4 py-2 border">{symbol.baseAsset}</td>
                                    <td className="px-4 py-2 border">{symbol.quoteAsset}</td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.Binance)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.OKEx)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.Bybit)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border">
                                        <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                                            编辑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">永续合约交易对</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2 border">交易对</th>
                                <th className="px-4 py-2 border">基础资产</th>
                                <th className="px-4 py-2 border">计价资产</th>
                                <th className="px-4 py-2 border">Binance</th>
                                <th className="px-4 py-2 border">OKEx</th>
                                <th className="px-4 py-2 border">Bybit</th>
                                <th className="px-4 py-2 border">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {perpetualSymbols.map((symbol: ExchangeSymbol) => (
                                <tr key={symbol.symbol} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border">{symbol.symbol}</td>
                                    <td className="px-4 py-2 border">{symbol.baseAsset}</td>
                                    <td className="px-4 py-2 border">{symbol.quoteAsset}</td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.Binance)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.OKEx)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <input type="checkbox" checked={!!(symbol.exchanges & Exchange.Bybit)} readOnly />
                                    </td>
                                    <td className="px-4 py-2 border">
                                        <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                                            编辑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
