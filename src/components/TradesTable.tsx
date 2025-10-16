import { useState, useMemo } from 'react';
import { Trade } from '../lib/types';

interface Props {
  trades: Trade[];
  dateFilter?: string; // Optional: if provided, uses external filter; otherwise uses internal
}

// Helper function to safely format date
const formatDate = (timestamp: string | number | undefined): string => {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  } catch {
    return '-';
  }
};

// Helper function to safely parse number
const safeParseFloat = (value: string | number | undefined, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to format money
const formatMoney = (value: string | number | undefined): string => {
  const num = safeParseFloat(value);
  return num.toFixed(2);
};

export default function TradesTable({ trades, dateFilter: externalDateFilter }: Props) {
  const [internalDateFilter, setInternalDateFilter] = useState<string>('7'); // Default to last 7 days

  // Use external filter if provided, otherwise use internal
  const dateFilter = externalDateFilter || internalDateFilter;
  const setDateFilter = externalDateFilter ? () => {} : setInternalDateFilter;

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const daysAgo = parseInt(dateFilter);
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(trade => {
        const tradeDate = new Date(trade.timestamp || 0);
        return tradeDate >= cutoffDate;
      });
    }

    // Sort by timestamp descending (newest first)
    return filtered
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 100); // Show up to 100 trades
  }, [trades, dateFilter]);

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No trades yet
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Date Filter Controls - Only show if no external filter */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Trades ({filteredTrades.length})
          </h3>
          {!externalDateFilter && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Show:</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Today</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {filteredTrades.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No trades found for the selected time period
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bet Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P&L
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tx
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTrades.map((trade, idx) => {
              const direction = trade.outcome === 0 ? 'YES' : trade.outcome === 1 ? 'NO' : '-';
              const directionColor = trade.outcome === 0 ? 'text-green-600' : trade.outcome === 1 ? 'text-red-600' : 'text-gray-600';
              const betSize = trade.investmentUSDC || trade.costUSDC || trade.redeemedUSDC || '0';
              const pnlValue = safeParseFloat(trade.pnlUSDC);

              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(trade.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TradeTypeBadge type={trade.type} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="font-medium">{trade.marketTitle || 'Unknown Market'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {trade.marketAddress && trade.marketAddress.length >= 42
                        ? `${trade.marketAddress.substring(0, 6)}...${trade.marketAddress.substring(38)}`
                        : trade.marketAddress || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col">
                      <span className={`font-bold ${directionColor}`}>
                        {direction}
                      </span>
                      {trade.strategy && (
                        <span className="text-xs text-gray-500 mt-1">
                          {trade.strategy}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${formatMoney(betSize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {trade.pnlUSDC ? (
                      <span className={pnlValue >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {pnlValue >= 0 ? '+' : ''}${formatMoney(trade.pnlUSDC)}
                        {trade.pnlPercent && ` (${formatMoney(trade.pnlPercent)}%)`}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {trade.txHash && trade.txHash.length >= 10 ? (
                      <a
                        href={`https://basescan.org/tx/${trade.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {trade.txHash.substring(0, 8)}...
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function TradeTypeBadge({ type }: { type: string }) {
  const badges = {
    BUY: 'bg-blue-100 text-blue-800',
    SELL_PROFIT: 'bg-green-100 text-green-800',
    SELL_STOP_LOSS: 'bg-red-100 text-red-800',
    REDEEM: 'bg-purple-100 text-purple-800',
  };

  const labels = {
    BUY: 'Buy',
    SELL_PROFIT: 'Sell (Profit)',
    SELL_STOP_LOSS: 'Sell (Stop Loss)',
    REDEEM: 'Redeem',
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
      {labels[type as keyof typeof labels] || type}
    </span>
  );
}
