import { Trade, Stats, Holding, RedemptionLog } from './types';

const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || 'limitless-bot-logs';
const S3_REGION = import.meta.env.VITE_S3_REGION || 'us-east-1';
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

async function fetchFile(filename: string): Promise<string> {
  const response = await fetch(`${S3_BASE_URL}/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
  }
  return response.text();
}

// Raw trade format from S3
interface RawTrade {
  blockTimestamp: string;
  market: {
    id: string;
    title: string;
    winningOutcomeIndex?: number;
    collateral: {
      symbol: string;
      decimals: number;
    };
  };
  outcomeIndex: number;
  outcomeTokenNetCost: string;
  outcomeTokenAmount: string;
  collateralAmount: string;
  outcomeTokenPrice: string;
  strategy: string;
  transactionHash: string;
}

function transformRawTrade(raw: RawTrade): Trade {
  // Convert blockTimestamp (Unix timestamp in seconds) to ISO string
  const timestamp = new Date(parseInt(raw.blockTimestamp) * 1000).toISOString();

  // Parse amounts (they're in wei/smallest unit for USDC with 6 decimals)
  const decimals = raw.market.collateral.decimals || 6;
  const costUSDC = (parseFloat(raw.outcomeTokenNetCost) / Math.pow(10, decimals)).toFixed(2);
  const collateralAmount = (parseFloat(raw.collateralAmount) / Math.pow(10, decimals)).toFixed(2);
  const outcomeAmount = parseFloat(raw.outcomeTokenAmount) / Math.pow(10, decimals);

  // Determine if this is a buy or sell/redeem
  const isBuy = raw.strategy === 'Buy';
  const isRedeem = raw.strategy === 'Redeem' || raw.strategy.includes('Redeem');
  const isSell = raw.strategy === 'Sell' || raw.strategy.includes('Sell');

  // Calculate P&L for closed positions
  let pnlUSDC: string | undefined;
  let pnlPercent: string | undefined;
  let result: 'WON' | 'LOST' | undefined;
  let type: Trade['type'] = 'BUY';
  let returnUSDC: string | undefined;

  // Handle sell/redeem transactions
  if (isRedeem || isSell) {
    // For redemptions and sells, collateralAmount is what we received
    returnUSDC = collateralAmount;
    const pnl = parseFloat(collateralAmount) - parseFloat(costUSDC);
    pnlUSDC = pnl.toFixed(2);

    if (parseFloat(costUSDC) !== 0) {
      pnlPercent = ((pnl / parseFloat(costUSDC)) * 100).toFixed(2);
    } else {
      pnlPercent = '0.00';
    }

    if (isRedeem) {
      type = 'REDEEM';
      result = pnl >= 0 ? 'WON' : 'LOST';
    } else {
      type = pnl > 0 ? 'SELL_PROFIT' : 'SELL_STOP_LOSS';
      result = pnl >= 0 ? 'WON' : 'LOST';
    }
  } else if (raw.market.winningOutcomeIndex !== undefined && raw.market.winningOutcomeIndex !== null) {
    // Market is closed (legacy handling for older data)
    const won = raw.market.winningOutcomeIndex === raw.outcomeIndex;
    result = won ? 'WON' : 'LOST';

    if (won) {
      // Won: get back the outcome token amount as USDC
      returnUSDC = outcomeAmount.toFixed(2);
      const pnl = outcomeAmount - parseFloat(costUSDC);
      pnlUSDC = pnl.toFixed(2);
      pnlPercent = ((pnl / parseFloat(costUSDC)) * 100).toFixed(2);
      type = pnl > 0 ? 'SELL_PROFIT' : 'SELL_STOP_LOSS';
    } else {
      // Lost: return is 0
      returnUSDC = '0.00';
      pnlUSDC = (-parseFloat(costUSDC)).toFixed(2);
      pnlPercent = '-100.00';
      type = 'SELL_STOP_LOSS';
    }
  }

  return {
    timestamp,
    type,
    wallet: '', // Not provided in raw data
    marketAddress: raw.market.id,
    marketTitle: raw.market.title,
    outcome: raw.outcomeIndex,
    outcomePrice: raw.outcomeTokenPrice,
    investmentUSDC: isBuy ? costUSDC : undefined,
    costUSDC,
    returnUSDC,
    pnlUSDC,
    pnlPercent,
    strategy: raw.strategy,
    txHash: raw.transactionHash,
    result,
  };
}

export async function fetchTrades(): Promise<Trade[]> {
  try {
    const data = await fetchFile('trades.jsonl');
    return data
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const raw = JSON.parse(line) as RawTrade;
        return transformRawTrade(raw);
      });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

function calculateStatsFromTrades(trades: Trade[]): Stats {
  let totalTrades = 0;
  let profitableTrades = 0;
  let losingTrades = 0;
  let totalProfitUSDC = 0;
  let totalLossUSDC = 0;
  let totalVolumeUSDC = 0;

  // Count only closed trades (SELL_PROFIT, SELL_STOP_LOSS, REDEEM) or trades with result
  const closedTrades = trades.filter(t =>
    t.type === 'SELL_PROFIT' ||
    t.type === 'SELL_STOP_LOSS' ||
    t.type === 'REDEEM' ||
    t.result !== undefined
  );

  closedTrades.forEach(trade => {
    totalTrades++;
    const pnl = parseFloat(trade.pnlUSDC || '0');

    if (pnl > 0 || trade.result === 'WON' || trade.type === 'SELL_PROFIT') {
      profitableTrades++;
      totalProfitUSDC += Math.abs(pnl);
    } else if (pnl < 0 || trade.result === 'LOST' || trade.type === 'SELL_STOP_LOSS') {
      losingTrades++;
      totalLossUSDC += Math.abs(pnl);
    }
  });

  // Calculate total volume from all trades (including open positions)
  trades.forEach(trade => {
    totalVolumeUSDC += parseFloat(trade.costUSDC || '0');
  });

  const netProfitUSDC = totalProfitUSDC - totalLossUSDC;
  const winRate = totalTrades > 0
    ? `${((profitableTrades / totalTrades) * 100).toFixed(1)}%`
    : '0%';

  // Calculate uptime (time between first and last trade)
  let startTime = Date.now();
  let lastUpdated = Date.now();
  let uptimeHours = '0';

  if (trades.length > 0) {
    const timestamps = trades
      .map(t => new Date(t.timestamp).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length > 0) {
      startTime = timestamps[0];
      lastUpdated = timestamps[timestamps.length - 1];
      uptimeHours = ((lastUpdated - startTime) / (1000 * 60 * 60)).toFixed(1);
    }
  }

  return {
    totalTrades,
    profitableTrades,
    losingTrades,
    totalProfitUSDC,
    totalLossUSDC,
    netProfitUSDC,
    winRate,
    uptimeHours,
    startTime,
    lastUpdated,
    tradedVolume: {
      total: totalVolumeUSDC,
    },
  };
}

interface PointsHistoryEntry {
  date: string;
  season1: number;
  season2: number;
  currentMonth: number;
  lastUpdated: string;
}

export async function fetchStats(): Promise<Stats | null> {
  try {
    // Fetch trades first
    const trades = await fetchTrades();
    let stats = calculateStatsFromTrades(trades);

    // Try to fetch points history
    try {
      const pointsData = await fetchFile('points_hist.json');
      const pointsHistory: PointsHistoryEntry[] = JSON.parse(pointsData);

      if (pointsHistory && pointsHistory.length > 0) {
        // Get the latest points entry
        const latest = pointsHistory[pointsHistory.length - 1];
        const totalPoints = (latest.season1 || 0) + (latest.season2 || 0);

        stats.points = {
          total: totalPoints,
          season1: latest.season1,
          season2: latest.season2,
          currentMonth: latest.currentMonth,
          history: pointsHistory,
        };
      }
    } catch (e) {
      console.log('Points history not available:', e);
    }

    // Try to fetch stats.json for additional data
    try {
      const data = await fetchFile('stats.json');
      const existingStats = JSON.parse(data) as Stats;
      // Merge with calculated stats, preferring existing stats for some fields
      stats = { ...stats, ...existingStats };
    } catch {
      // Use calculated stats
    }

    return stats;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

export async function fetchState(): Promise<Record<string, { holdings: Holding[] }> | null> {
  try {
    const data = await fetchFile('state.json');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error fetching state:', error);
    return null;
  }
}

export async function fetchRedemptions(): Promise<RedemptionLog[]> {
  try {
    const data = await fetchFile('redemptions.jsonl');
    return data
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as RedemptionLog);
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    return [];
  }
}
