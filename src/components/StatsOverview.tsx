import { useMemo } from 'react';
import { Stats, Trade } from '../lib/types';

interface Props {
  stats: Stats;
  trades: Trade[];
  dateFilter: string;
}

// Helper function to safely parse number
const safeParseFloat = (value: any, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default function StatsOverview({ stats, trades, dateFilter }: Props) {
  // Calculate filtered stats based on date range
  const filteredStats = useMemo(() => {
    let filteredTrades = trades;

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const daysAgo = parseInt(dateFilter);
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      filteredTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.timestamp || 0);
        return tradeDate >= cutoffDate;
      });
    }

    // Calculate stats from filtered trades
    let totalTrades = 0;
    let profitableTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalVolume = 0;

    filteredTrades.forEach(trade => {
      // Only count trades with P&L (completed trades)
      if (trade.pnlUSDC) {
        totalTrades++;
        const pnl = safeParseFloat(trade.pnlUSDC);
        const cost = safeParseFloat(trade.costUSDC);

        if (pnl > 0) {
          profitableTrades++;
          totalProfit += pnl;
        } else if (pnl < 0) {
          losingTrades++;
          totalLoss += Math.abs(pnl);
        }

        totalVolume += cost;
      }
    });

    const netProfit = totalProfit - totalLoss;
    const winRate = totalTrades > 0
      ? `${((profitableTrades / totalTrades) * 100).toFixed(1)}%`
      : '0.0%';

    return {
      totalTrades,
      profitableTrades,
      losingTrades,
      totalProfit,
      totalLoss,
      netProfit,
      winRate,
      totalVolume,
    };
  }, [trades, dateFilter]);

  const isProfit = filteredStats.netProfit >= 0;
  const winLossRatio = filteredStats.losingTrades > 0
    ? (filteredStats.profitableTrades / filteredStats.losingTrades).toFixed(2)
    : filteredStats.profitableTrades > 0 ? '∞' : '0';

  // Extract points if available (not filtered, always show total)
  const pointsValue = safeParseFloat(stats.points?.total || stats.points?.points);
  const volumeValue = dateFilter === 'all'
    ? safeParseFloat(stats.tradedVolume?.total || stats.tradedVolume?.volume)
    : filteredStats.totalVolume;

  return (
    <div className="space-y-6">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Trades"
          value={filteredStats.totalTrades}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Win Rate"
          value={filteredStats.winRate}
          subtitle={`${filteredStats.profitableTrades}W / ${filteredStats.losingTrades}L`}
          icon="🎯"
          color="purple"
        />
        <StatCard
          title="Net P&L"
          value={`$${filteredStats.netProfit.toFixed(2)}`}
          subtitle={`+$${filteredStats.totalProfit.toFixed(2)} / -$${filteredStats.totalLoss.toFixed(2)}`}
          icon={isProfit ? "💰" : "📉"}
          color={isProfit ? "green" : "red"}
        />
        <StatCard
          title="Win/Loss Ratio"
          value={winLossRatio}
          subtitle={`${filteredStats.profitableTrades} wins : ${filteredStats.losingTrades} losses`}
          icon="⚖️"
          color={parseFloat(winLossRatio) >= 1 ? "green" : "red"}
        />
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Points"
          value={pointsValue > 0 ? pointsValue.toLocaleString() : '0'}
          subtitle="Limitless Points"
          icon="⭐"
          color="purple"
        />
        <StatCard
          title="Total Volume"
          value={volumeValue > 0 ? `$${volumeValue.toLocaleString()}` : '$0'}
          subtitle="Traded Volume"
          icon="💹"
          color="blue"
        />
        <StatCard
          title="Avg Trade Size"
          value={filteredStats.totalTrades > 0
            ? `$${(volumeValue / filteredStats.totalTrades).toFixed(2)}`
            : '$0.00'
          }
          subtitle="per trade"
          icon="📈"
          color="gray"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'gray';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${colorClasses[color]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}
