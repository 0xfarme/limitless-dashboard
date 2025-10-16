import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

interface Props {
  pointsData: any;
  volumeData: any;
}

// Helper function to safely parse number
const safeParseFloat = (value: any, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default function PointsDisplay({ pointsData, volumeData }: Props) {
  const processedData = useMemo(() => {
    if (!pointsData) return null;

    // Handle different possible API response formats
    const history = pointsData.history || [];
    const season1 = safeParseFloat(pointsData.season1);
    const season2 = safeParseFloat(pointsData.season2);
    const totalPoints = season1 + season2; // Sum of Season 1 + Season 2
    const currentMonth = safeParseFloat(pointsData.currentMonth);

    // Calculate current week points (last 7 days from history)
    let currentWeekPoints = 0;
    if (history && history.length > 0) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentEntries = history.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate >= weekAgo;
      });

      if (recentEntries.length > 1) {
        const oldestRecent = recentEntries[0];
        const newestRecent = recentEntries[recentEntries.length - 1];
        const oldestTotal = safeParseFloat(oldestRecent.season1) + safeParseFloat(oldestRecent.season2);
        const newestTotal = safeParseFloat(newestRecent.season1) + safeParseFloat(newestRecent.season2);
        currentWeekPoints = newestTotal - oldestTotal;
      }
    }

    return {
      history,
      totalPoints,
      season1,
      season2,
      currentMonth,
      currentWeekPoints,
    };
  }, [pointsData]);

  // Prepare chart data combining points history with volume
  const chartData = useMemo(() => {
    if (!processedData?.history || processedData.history.length === 0) {
      return [];
    }

    return processedData.history.map((entry: any) => {
      const season1 = safeParseFloat(entry.season1);
      const season2 = safeParseFloat(entry.season2);
      const totalPoints = season1 + season2;

      return {
        date: entry.date || 'Unknown',
        season1,
        season2,
        totalPoints,
        currentMonth: safeParseFloat(entry.currentMonth),
        // Volume data will be added by lambda in future updates
        volume: safeParseFloat(entry.volume),
        pointsPerDollar: entry.volume && entry.volume > 0
          ? (totalPoints / entry.volume).toFixed(4)
          : 0,
      };
    });
  }, [processedData]);

  // Calculate volume metrics
  const volumeMetrics = useMemo(() => {
    const totalVolume = safeParseFloat(
      typeof volumeData === 'number' ? volumeData : volumeData?.total
    );

    // Calculate weekly volume from history
    let weeklyVolume = 0;
    if (processedData?.history && processedData.history.length > 0) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentEntries = processedData.history.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate >= weekAgo;
      });

      if (recentEntries.length > 1) {
        const oldestRecent = recentEntries[0];
        const newestRecent = recentEntries[recentEntries.length - 1];
        weeklyVolume = safeParseFloat(newestRecent.volume) - safeParseFloat(oldestRecent.volume);
      } else if (recentEntries.length === 1) {
        weeklyVolume = safeParseFloat(recentEntries[0].volume);
      }
    }

    return {
      totalVolume,
      weeklyVolume,
    };
  }, [volumeData, processedData]);

  if (!processedData && !volumeData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Points Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Points Growth Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="totalPoints" stroke="#8b5cf6" strokeWidth={2} name="Total Points" dot={{ fill: '#8b5cf6' }} />
              <Line type="monotone" dataKey="season1" stroke="#6366f1" strokeWidth={2} name="Season 1" dot={{ fill: '#6366f1' }} />
              <Line type="monotone" dataKey="season2" stroke="#ec4899" strokeWidth={2} name="Season 2" dot={{ fill: '#ec4899' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Points & Volume Correlation Chart */}
      {chartData.length > 0 && chartData.some((d: any) => d.volume > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Points & Volume Correlation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" label={{ value: 'Points', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Volume ($)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="right" dataKey="volume" fill="#3b82f6" name="Volume ($)" />
              <Line yAxisId="left" type="monotone" dataKey="totalPoints" stroke="#8b5cf6" strokeWidth={3} name="Total Points" dot={{ fill: '#8b5cf6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Points Efficiency Chart */}
      {chartData.length > 0 && chartData.some((d: any) => d.volume > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Points Efficiency (Points per Dollar)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => value.toFixed(4)} />
              <Legend />
              <Bar dataKey="pointsPerDollar" fill="#10b981" name="Points per $" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Points Overview */}
      {processedData && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">Points & Volume Metrics</h3>
          </div>

          {/* Points KPIs */}
          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-700 mb-3">Points Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-600">Total Points</p>
                <p className="text-3xl font-bold text-purple-700 mt-1">
                  {processedData.totalPoints > 0
                    ? processedData.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '0'}
                </p>
                <p className="text-xs text-purple-500 mt-1">Season 1 + Season 2</p>
              </div>

              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm font-medium text-indigo-600">Season 1</p>
                <p className="text-3xl font-bold text-indigo-700 mt-1">
                  {processedData.season1 > 0
                    ? processedData.season1.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '0'}
                </p>
              </div>

              <div className="bg-violet-50 rounded-lg p-4">
                <p className="text-sm font-medium text-violet-600">Season 2</p>
                <p className="text-3xl font-bold text-violet-700 mt-1">
                  {processedData.season2 > 0
                    ? processedData.season2.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '0'}
                </p>
              </div>

              <div className="bg-pink-50 rounded-lg p-4">
                <p className="text-sm font-medium text-pink-600">Current Week</p>
                <p className="text-3xl font-bold text-pink-700 mt-1">
                  {processedData.currentWeekPoints > 0
                    ? `+${processedData.currentWeekPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : '0'}
                </p>
                <p className="text-xs text-pink-500 mt-1">Last 7 days</p>
              </div>

              <div className="bg-rose-50 rounded-lg p-4">
                <p className="text-sm font-medium text-rose-600">Current Month</p>
                <p className="text-3xl font-bold text-rose-700 mt-1">
                  {processedData.currentMonth > 0
                    ? processedData.currentMonth.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Volume KPIs */}
          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-700 mb-3">Volume Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-600">Overall Volume</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">
                  {volumeMetrics.totalVolume > 0
                    ? `$${volumeMetrics.totalVolume.toLocaleString()}`
                    : '$0'}
                </p>
                <p className="text-xs text-blue-500 mt-1">All-time trading volume</p>
              </div>

              <div className="bg-cyan-50 rounded-lg p-4">
                <p className="text-sm font-medium text-cyan-600">Weekly Volume</p>
                <p className="text-3xl font-bold text-cyan-700 mt-1">
                  {volumeMetrics.weeklyVolume > 0
                    ? `$${volumeMetrics.weeklyVolume.toLocaleString()}`
                    : '$0'}
                </p>
                <p className="text-xs text-cyan-500 mt-1">Last 7 days</p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm font-medium text-green-600">Points/Volume Ratio</p>
                <p className="text-3xl font-bold text-green-700 mt-1">
                  {volumeMetrics.totalVolume > 0
                    ? (processedData.totalPoints / volumeMetrics.totalVolume).toFixed(4)
                    : '0'}
                </p>
                <p className="text-xs text-green-500 mt-1">Points per dollar</p>
              </div>
            </div>
          </div>

          {/* Points History Table */}
          {processedData.history && processedData.history.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Points History by Day</h4>
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
                        Season 1
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Season 2
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Month
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Volume
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.history.slice().reverse().slice(0, 30).map((entry: any, idx: number) => {
                      const season1 = safeParseFloat(entry.season1);
                      const season2 = safeParseFloat(entry.season2);
                      const currentMonth = safeParseFloat(entry.currentMonth);
                      const total = season1 + season2;
                      const volume = safeParseFloat(entry.volume);

                      return (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.date || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-semibold">
                            {season1 > 0 ? season1.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-violet-600 font-semibold">
                            {season2 > 0 ? season2.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-600 font-semibold">
                            {currentMonth > 0 ? currentMonth.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-bold">
                            {total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            ${volume > 0 ? volume.toLocaleString() : '0'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Volume Details */}
      {volumeData && volumeData.byDay && volumeData.byDay.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Volume by Day</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volume
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trades
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {volumeData.byDay.map((day: any, idx: number) => {
                  const volume = safeParseFloat(day.volume);
                  const trades = safeParseFloat(day.trades);

                  return (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {day.date || 'Unknown Date'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                        ${volume > 0 ? volume.toLocaleString() : '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trades > 0 ? trades : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
