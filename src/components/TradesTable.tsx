import { Trade } from '../lib/types';

interface Props {
  trades: Trade[];
}

export default function TradesTable({ trades }: Props) {
  // Show most recent trades first
  const sortedTrades = [...trades].reverse().slice(0, 50);

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No trades yet
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
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
                Amount
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
            {sortedTrades.map((trade, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(trade.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <TradeTypeBadge type={trade.type} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                  {trade.marketTitle || `${trade.marketAddress.substring(0, 8)}...`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${trade.investmentUSDC || trade.costUSDC || trade.redeemedUSDC || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {trade.pnlUSDC && (
                    <span className={parseFloat(trade.pnlUSDC) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {parseFloat(trade.pnlUSDC) >= 0 ? '+' : ''}${trade.pnlUSDC}
                      {trade.pnlPercent && ` (${trade.pnlPercent}%)`}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    href={`https://basescan.org/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {trade.txHash.substring(0, 8)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
