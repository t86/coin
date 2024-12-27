import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceTableProps {
  marketType: 'spot' | 'perpetual';
}

interface PriceResponse {
  success: boolean;
  data: {
    prices: Array<any>;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

type SortField = 'binance' | 'okex' | 'bybit' | 'binanceOkex' | 'binanceBybit' | 'okexBybit';
type SortDirection = 'asc' | 'desc' | null;

export default function PriceTable({ marketType }: PriceTableProps) {
  const [data, setData] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const pageSize = 20;

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        marketType,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(sortField && { sortField }),
        ...(sortDirection && { sortDirection })
      });
      
      const response = await fetch(`/api/prices?${queryParams}`);
      const newData = await response.json();
      setData(newData);
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, [marketType, currentPage, sortField, sortDirection]);

  const totalPages = data?.data?.pagination?.totalPages || 1;

  // 格式化资金费率显示
  const formatFundingRate = (rate: string | null) => {
    if (!rate) return '-';
    const percentage = (parseFloat(rate) * 100).toFixed(4);
    return `${percentage}%`;
  };

  // 格式化下次资金费率时间
  const formatNextFundingTime = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString();
  };

  // 处理排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 排序图标组件
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // 可排序的表头单元格
  const SortableHeader = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon field={field} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          每10秒自动刷新
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>交易对</TableHead>
            <TableHead>Binance</TableHead>
            <TableHead>OKEx</TableHead>
            <TableHead>Bybit</TableHead>
            {marketType === 'perpetual' && (
              <>
                <SortableHeader field="binance">Binance资金费率</SortableHeader>
                <SortableHeader field="okex">OKEx资金费率</SortableHeader>
                <SortableHeader field="bybit">Bybit资金费率</SortableHeader>
                <TableHead>下次资金费率时间</TableHead>
                <SortableHeader field="binanceOkex">资金费率差(B-O)</SortableHeader>
                <SortableHeader field="binanceBybit">资金费率差(B-By)</SortableHeader>
                <SortableHeader field="okexBybit">资金费率差(O-By)</SortableHeader>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data?.prices?.map((price: any) => (
            <TableRow key={price.symbol}>
              <TableCell>{price.symbol}</TableCell>
              <TableCell>{price.prices.binance || '-'}</TableCell>
              <TableCell>{price.prices.okex || '-'}</TableCell>
              <TableCell>{price.prices.bybit || '-'}</TableCell>
              {marketType === 'perpetual' && (
                <>
                  <TableCell>{formatFundingRate(price.funding_rates?.binance)}</TableCell>
                  <TableCell>{formatFundingRate(price.funding_rates?.okex)}</TableCell>
                  <TableCell>{formatFundingRate(price.funding_rates?.bybit)}</TableCell>
                  <TableCell>{formatNextFundingTime(price.next_funding_time?.binance)}</TableCell>
                  <TableCell>{price.fundingRateDiffs?.binanceOkex?.toFixed(4) || '-'}</TableCell>
                  <TableCell>{price.fundingRateDiffs?.binanceBybit?.toFixed(4) || '-'}</TableCell>
                  <TableCell>{price.fundingRateDiffs?.okexBybit?.toFixed(4) || '-'}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 