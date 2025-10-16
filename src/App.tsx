import { useState, useEffect } from 'react';
import { fetchTrades, fetchStats, fetchState } from './lib/s3Client';
import { Trade, Stats, Holding } from './lib/types';
import StatsOverview from './components/StatsOverview';
import TradesTable from './components/TradesTable';
import PositionsTable from './components/PositionsTable';
import DailyBreakdown from './components/DailyBreakdown';
import PointsDisplay from './components/PointsDisplay';

// Tracked wallet address
const WALLET_ADDRESS = '0x967ee892abEbD0953b1C50EFA25b9b17df96d867';

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'points'>('overview');
  const [dateFilter, setDateFilter] = useState<string>('7'); // Global date filter for Overview tab

  const loadData = async () => {
    setLoading(true);
    try {
      const [tradesData, statsData, stateData] = await Promise.all([
        fetchTrades(),
        fetchStats(),
        fetchState(),
      ]);

      setTrades(tradesData);
      setStats(statsData);

      // Extract all holdings from state
      if (stateData) {
        const allHoldings: Holding[] = [];
        Object.values(stateData).forEach((walletState: any) => {
          if (walletState.holdings) {
            allHoldings.push(...walletState.holdings);
          }
        });
        setHoldings(allHoldings);
      }

      // Use Lambda's lastUpdated timestamp if available, otherwise use current time
      if (statsData?.lastUpdated) {
        setLastUpdate(new Date(statsData.lastUpdated));
      } else {
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Reload every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col items-center justify-center text-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Limitless Trading Dashboard
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-gray-500">
                Wallet: <span className="font-mono font-semibold text-gray-700">{formatWalletAddress(WALLET_ADDRESS)}</span>
              </p>
              <span className="text-gray-300">•</span>
              <p className="text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('points')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'points'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Points & Volume
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && trades.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard data...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Global Date Filter for Overview */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Date Range Filter</h3>
                      <p className="text-sm text-gray-500 mt-1">Filter applies to stats and trades below</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 font-medium">Show data for:</label>
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="1">Today</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="all">All time</option>
                      </select>
                    </div>
                  </div>
                </div>

                {stats && <StatsOverview stats={stats} trades={trades} dateFilter={dateFilter} />}

                {holdings.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      Active Positions ({holdings.length})
                    </h2>
                    <PositionsTable holdings={holdings} />
                  </section>
                )}

                <section>
                  <TradesTable trades={trades} dateFilter={dateFilter} />
                </section>
              </>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <>
                {stats && (
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Metrics</h2>
                    <StatsOverview stats={stats} />
                  </div>
                )}
                <DailyBreakdown trades={trades} />
              </>
            )}

            {/* Points & Volume Tab */}
            {activeTab === 'points' && (
              <PointsDisplay
                pointsData={stats?.points}
                volumeData={stats?.tradedVolume}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              Need more details or have questions?
            </p>
            <a
              href="https://twitter.com/0xfarmed"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Contact @0xfarmed on Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
