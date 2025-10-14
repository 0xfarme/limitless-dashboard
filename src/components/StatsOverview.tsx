import { Stats } from '../lib/types';

interface Props {
  stats: Stats;
}

export default function StatsOverview({ stats }: Props) {
  const isProfit = stats.netProfitUSDC >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Trades"
        value={stats.totalTrades}
        icon="📊"
        color="blue"
      />
      <StatCard
        title="Win Rate"
        value={stats.winRate}
        subtitle={`${stats.profitableTrades}W / ${stats.losingTrades}L`}
        icon="🎯"
        color="purple"
      />
      <StatCard
        title="Net P&L"
        value={`$${stats.netProfitUSDC.toFixed(2)}`}
        subtitle={`+$${stats.totalProfitUSDC.toFixed(2)} / -$${stats.totalLossUSDC.toFixed(2)}`}
        icon={isProfit ? "💰" : "📉"}
        color={isProfit ? "green" : "red"}
      />
      <StatCard
        title="Uptime"
        value={stats.uptimeHours}
        subtitle="hours"
        icon="⏱️"
        color="gray"
      />
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
