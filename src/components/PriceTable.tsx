import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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

export default function PriceTable({ marketType }: PriceTableProps) {
  const [data, setData] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // 每页显示20条数据

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/prices?marketType=${marketType}&page=${currentPage}&pageSize=${pageSize}`
      );
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
  }, [marketType, currentPage]);

  const totalPages = data?.data?.pagination?.totalPages || 1;

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
                <TableHead>资金费率差(B-O)</TableHead>
                <TableHead>资金费率差(B-By)</TableHead>
                <TableHead>资金费率差(O-By)</TableHead>
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
              {marketType === 'perpetual' && price.fundingRateDiffs && (
                <>
                  <TableCell>{price.fundingRateDiffs.binanceOkex?.toFixed(4) || '-'}</TableCell>
                  <TableCell>{price.fundingRateDiffs.binanceBybit?.toFixed(4) || '-'}</TableCell>
                  <TableCell>{price.fundingRateDiffs.okexBybit?.toFixed(4) || '-'}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 