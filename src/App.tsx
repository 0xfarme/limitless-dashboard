import { useState, useEffect } from 'react';
import { fetchTrades, fetchStats, fetchState } from './lib/s3Client';
import { Trade, Stats, Holding } from './lib/types';
import StatsOverview from './components/StatsOverview';
import TradesTable from './components/TradesTable';
import PositionsTable from './components/PositionsTable';

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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

      setLastUpdate(new Date());
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Limitless Bot Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
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
            {stats && <StatsOverview stats={stats} />}

            {holdings.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Active Positions ({holdings.length})
                </h2>
                <PositionsTable holdings={holdings} />
              </section>
            )}

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Recent Trades ({trades.length})
              </h2>
              <TradesTable trades={trades} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
