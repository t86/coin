import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Symbol {
  symbol: string;
  marketType: string;
  baseAsset: string;
  quoteAsset: string;
  exchanges: number;
  fetch: number;
}

export default function SymbolsConfig() {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [search, setSearch] = useState('');
  const [marketType, setMarketType] = useState('spot');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [assetOptions, setAssetOptions] = useState({
    baseAsset: 'all',
    quoteAsset: 'all'
  });
  const [uniqueAssets, setUniqueAssets] = useState<{
    baseAssets: string[];
    quoteAssets: string[];
  }>({ baseAssets: [], quoteAssets: [] });

  const fetchSymbols = async () => {
    try {
      const queryParams = new URLSearchParams({
        marketType,
        search,
        ...(assetOptions.baseAsset !== 'all' && { baseAsset: assetOptions.baseAsset }),
        ...(assetOptions.quoteAsset !== 'all' && { quoteAsset: assetOptions.quoteAsset })
      });
      
      const response = await fetch(`/api/admin/symbols?${queryParams}`);
      const data = await response.json();
      setSymbols(data);

      // 提取唯一的基础资产和计价资产
      const baseAssets = new Set<string>();
      const quoteAssets = new Set<string>();
      data.forEach((symbol: Symbol) => {
        baseAssets.add(symbol.baseAsset);
        quoteAssets.add(symbol.quoteAsset);
      });

      setUniqueAssets({
        baseAssets: Array.from(baseAssets).sort(),
        quoteAssets: Array.from(quoteAssets).sort()
      });
    } catch (error) {
      console.error('Error fetching symbols:', error);
    }
  };

  useEffect(() => {
    fetchSymbols();
  }, [marketType, search, assetOptions]);

  const toggleAllRows = (checked: boolean) => {
    if (checked) {
      const allSymbols = symbols.map(s => s.symbol);
      setSelectedRows(new Set(allSymbols));
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleRow = (symbol: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(symbol)) {
      newSelected.delete(symbol);
    } else {
      newSelected.add(symbol);
    }
    setSelectedRows(newSelected);
  };

  const handleBatchToggleFetch = async (fetchEnabled: number) => {
    if (selectedRows.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedRows).map(symbol =>
          fetch('/api/admin/symbols/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, marketType, fetch: fetchEnabled })
          })
        )
      );
      fetchSymbols();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Error updating symbols:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <Input
          placeholder="搜索交易对..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={marketType}
          onValueChange={setMarketType}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="市场类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spot">现货</SelectItem>
            <SelectItem value="perpetual">合约</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={assetOptions.baseAsset}
          onValueChange={(value) => setAssetOptions(prev => ({ ...prev, baseAsset: value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="基础资产" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {uniqueAssets.baseAssets.map(asset => (
              <SelectItem key={asset} value={asset}>{asset}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assetOptions.quoteAsset}
          onValueChange={(value) => setAssetOptions(prev => ({ ...prev, quoteAsset: value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="计价资产" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {uniqueAssets.quoteAssets.map(asset => (
              <SelectItem key={asset} value={asset}>{asset}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRows.size > 0 && (
        <div className="flex gap-4 items-center">
          <button
            onClick={() => handleBatchToggleFetch(1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            批量启用
          </button>
          <button
            onClick={() => handleBatchToggleFetch(0)}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md"
          >
            批量禁用
          </button>
          <span className="text-sm text-muted-foreground">
            已选择 {selectedRows.size} 个交易对
          </span>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]">
              <Checkbox
                checked={selectedRows.size === symbols.length}
                onCheckedChange={toggleAllRows}
              />
            </TableHead>
            <TableHead>交易对</TableHead>
            <TableHead>基础资产</TableHead>
            <TableHead>计价资产</TableHead>
            <TableHead>交易所</TableHead>
            <TableHead>启用</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {symbols.map((symbol) => (
            <TableRow key={symbol.symbol}>
              <TableCell>
                <Checkbox
                  checked={selectedRows.has(symbol.symbol)}
                  onCheckedChange={() => toggleRow(symbol.symbol)}
                />
              </TableCell>
              <TableCell>{symbol.symbol}</TableCell>
              <TableCell>{symbol.baseAsset}</TableCell>
              <TableCell>{symbol.quoteAsset}</TableCell>
              <TableCell>
                {[
                  symbol.exchanges & 1 && 'Binance',
                  symbol.exchanges & 2 && 'OKEx',
                  symbol.exchanges & 4 && 'Bybit'
                ].filter(Boolean).join(', ')}
              </TableCell>
              <TableCell>
                <Switch
                  checked={symbol.fetch === 1}
                  onCheckedChange={() => handleBatchToggleFetch(symbol.fetch === 1 ? 0 : 1)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 