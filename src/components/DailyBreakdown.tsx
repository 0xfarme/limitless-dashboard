import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Trade, DailyStats } from '../lib/types';

interface Props {
  trades: Trade[];
}

export default function DailyBreakdown({ trades }: Props) {
  const dailyStats = useMemo(() => {
    return calculateDailyStats(trades);
  }, [trades]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (dailyStats.length === 0) return null;

    const totalDays = dailyStats.length;
    const totalTrades = dailyStats.reduce((sum, day) => sum + day.trades, 0);
    const totalWins = dailyStats.reduce((sum, day) => sum + day.wins, 0);
    const totalLosses = dailyStats.reduce((sum, day) => sum + day.losses, 0);
    const totalProfit = dailyStats.reduce((sum, day) => sum + day.profitUSDC, 0);
    const totalLoss = dailyStats.reduce((sum, day) => sum + day.lossUSDC, 0);
    const netProfit = dailyStats.reduce((sum, day) => sum + day.netProfitUSDC, 0);
    const totalVolume = dailyStats.reduce((sum, day) => sum + day.volumeUSDC, 0);
    const avgWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0.0';
    const avgDailyVolume = totalVolume / totalDays;
    const avgDailyTrades = totalTrades / totalDays;

    return {
      totalDays,
      totalTrades,
      totalWins,
      totalLosses,
      totalProfit,
      totalLoss,
      netProfit,
      totalVolume,
      avgWinRate,
      avgDailyVolume,
      avgDailyTrades,
    };
  }, [dailyStats]);

  if (dailyStats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      {summary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Performance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-600">Total Days Trading</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{summary.totalDays}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-600">Total Trades</p>
              <p className="text-3xl font-bold text-purple-700 mt-1">{summary.totalTrades}</p>
              <p className="text-xs text-purple-500 mt-1">
                Avg: {summary.avgDailyTrades.toFixed(1)}/day
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-600">Overall Win Rate</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{summary.avgWinRate}%</p>
              <p className="text-xs text-green-500 mt-1">
                {summary.totalWins}W / {summary.totalLosses}L
              </p>
            </div>
            <div className={`rounded-lg p-4 ${summary.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className={`text-sm font-medium ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Total Net P&L
              </p>
              <p className={`text-3xl font-bold mt-1 ${summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                ${summary.netProfit.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${summary.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                +${summary.totalProfit.toFixed(2)} / -${summary.totalLoss.toFixed(2)}
              </p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-4">
              <p className="text-sm font-medium text-cyan-600">Total Volume</p>
              <p className="text-3xl font-bold text-cyan-700 mt-1">${summary.totalVolume.toLocaleString()}</p>
              <p className="text-xs text-cyan-500 mt-1">
                Avg: ${summary.avgDailyVolume.toFixed(0)}/day
              </p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-600">Avg Profit per Win</p>
              <p className="text-3xl font-bold text-indigo-700 mt-1">
                ${summary.totalWins > 0 ? (summary.totalProfit / summary.totalWins).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-sm font-medium text-rose-600">Avg Loss per Loss</p>
              <p className="text-3xl font-bold text-rose-700 mt-1">
                ${summary.totalLosses > 0 ? (summary.totalLoss / summary.totalLosses).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-600">Profit Factor</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">
                {summary.totalLoss > 0 ? (summary.totalProfit / summary.totalLoss).toFixed(2) : 'N/A'}
              </p>
              <p className="text-xs text-amber-500 mt-1">Profit / Loss ratio</p>
            </div>
          </div>
        </div>
      )}

      {/* Day-over-Day Comparison Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Day-over-Day Metrics</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="trades" stroke="#3b82f6" strokeWidth={2} name="Trades" dot={{ fill: '#3b82f6' }} />
            <Line yAxisId="left" type="monotone" dataKey="wins" stroke="#10b981" strokeWidth={2} name="Wins" dot={{ fill: '#10b981' }} />
            <Line yAxisId="left" type="monotone" dataKey="losses" stroke="#ef4444" strokeWidth={2} name="Losses" dot={{ fill: '#ef4444' }} />
            <Line yAxisId="right" type="monotone" dataKey="volumeUSDC" stroke="#8b5cf6" strokeWidth={2} name="Volume ($)" dot={{ fill: '#8b5cf6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trades by Day Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Trades by Day</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="wins" fill="#10b981" name="Winning Trades" />
            <Bar dataKey="losses" fill="#ef4444" name="Losing Trades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily P&L Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Daily P&L</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="netProfitUSDC"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Net P&L"
              dot={{ fill: '#8b5cf6' }}
            />
            <Line
              type="monotone"
              dataKey="profitUSDC"
              stroke="#10b981"
              strokeWidth={2}
              name="Profit"
              dot={{ fill: '#10b981' }}
            />
            <Line
              type="monotone"
              dataKey="lossUSDC"
              stroke="#ef4444"
              strokeWidth={2}
              name="Loss"
              dot={{ fill: '#ef4444' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Volume Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Daily Volume</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend />
            <Bar dataKey="volumeUSDC" fill="#3b82f6" name="Volume (USDC)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Stats Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="text-xl font-bold text-gray-900">Daily Summary</h3>
          <p className="text-sm text-gray-500">Showing last 30 days</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W/L
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Win Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net P&L
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dailyStats.slice(0, 30).map((day) => {
                const winRate = day.trades > 0
                  ? ((day.wins / day.trades) * 100).toFixed(1)
                  : '0.0';
                const isProfit = day.netProfitUSDC >= 0;

                return (
                  <tr key={day.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {day.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {day.trades}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="text-green-600">{day.wins}</span>
                      {' / '}
                      <span className="text-red-600">{day.losses}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {winRate}%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      isProfit ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${day.netProfitUSDC.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${day.volumeUSDC.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper function to safely parse number
const safeParseFloat = (value: string | number | undefined, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(parsed) ? defaultValue : parsed;
};

function calculateDailyStats(trades: Trade[]): DailyStats[] {
  const dailyMap: Record<string, DailyStats & { timestamp: number }> = {};

  trades.forEach((trade) => {
    // Safely parse the date
    let date: string;
    let timestamp: number;
    try {
      const parsedDate = new Date(trade.timestamp);
      if (isNaN(parsedDate.getTime())) {
        date = 'Invalid Date';
        timestamp = 0;
      } else {
        date = parsedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        timestamp = parsedDate.getTime();
      }
    } catch {
      date = 'Invalid Date';
      timestamp = 0;
    }

    if (!dailyMap[date]) {
      dailyMap[date] = {
        date,
        timestamp,
        trades: 0,
        wins: 0,
        losses: 0,
        profitUSDC: 0,
        lossUSDC: 0,
        netProfitUSDC: 0,
        volumeUSDC: 0,
      };
    }

    const stats = dailyMap[date];

    // Count completed trades
    if (trade.type === 'SELL_PROFIT' || trade.type === 'SELL_STOP_LOSS' || trade.type === 'REDEEM') {
      stats.trades++;

      const pnl = safeParseFloat(trade.pnlUSDC);
      if (pnl > 0 || trade.result === 'WON') {
        stats.wins++;
        stats.profitUSDC += Math.abs(pnl);
      } else if (pnl < 0 || trade.result === 'LOST') {
        stats.losses++;
        stats.lossUSDC += Math.abs(pnl);
      }

      stats.netProfitUSDC += pnl;
    }

    // Track volume for all trades
    const cost = safeParseFloat(trade.costUSDC || trade.investmentUSDC);
    const returnValue = safeParseFloat(trade.returnUSDC || trade.redeemedUSDC);
    stats.volumeUSDC += Math.max(cost, returnValue);
  });

  // Convert to array and sort by date (newest first)
  return Object.values(dailyMap)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ timestamp, ...rest }) => rest);
}
