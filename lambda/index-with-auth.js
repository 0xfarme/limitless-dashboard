const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'limitless-bot-logs';
const LIMITLESS_API_URL = 'https://api.limitless.exchange';

// Authentication credentials (set these in Lambda environment variables)
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_REFRESH_TOKEN = process.env.PRIVY_REFRESH_TOKEN;

// Store access token in memory (persists between Lambda warm starts)
let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Lambda handler that fetches data from Limitless Exchange API and uploads to S3
 */
exports.handler = async (event) => {
  console.log('Starting trade file generation from Limitless API...');

  try {
    // Ensure we have a valid access token
    await ensureValidToken();

    // Fetch data from Limitless Exchange API
    const positions = await fetchPositions();
    const trades = await fetchTrades();
    const points = await fetchPoints();
    const volume = await fetchTradedVolume();

    // Calculate statistics from trades
    const stats = calculateStats(trades, points, volume);

    // Format state from positions
    const state = formatState(positions);

    // Upload files to S3
    await Promise.all([
      uploadToS3('trades.jsonl', formatTradesAsJsonl(trades)),
      uploadToS3('stats.json', JSON.stringify(stats, null, 2)),
      uploadToS3('state.json', JSON.stringify(state, null, 2)),
    ]);

    console.log('Successfully uploaded all files to S3');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Trade files generated successfully',
        trades: trades.length,
        positions: positions.length,
        stats: stats,
      }),
    };
  } catch (error) {
    console.error('Error generating trade files:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error generating trade files',
        error: error.message,
      }),
    };
  }
};

/**
 * Ensure we have a valid access token, refresh if needed
 */
async function ensureValidToken() {
  const now = Date.now();

  // If token is still valid (with 5 minute buffer), use cached token
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    console.log('Using cached access token');
    return;
  }

  console.log('Refreshing access token...');

  try {
    const response = await fetch('https://auth.privy.io/api/v1/sessions/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'privy-app-id': PRIVY_APP_ID,
      },
      body: JSON.stringify({
        refresh_token: PRIVY_REFRESH_TOKEN,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    cachedAccessToken = data.token; // or data.access_token depending on response format

    // JWT tokens typically expire in 1 hour, but check the actual expiry if provided
    tokenExpiresAt = now + 3600000; // 1 hour default

    console.log('Access token refreshed successfully');
  } catch (error) {
    console.error('Failed to refresh token:', error);
    throw error;
  }
}

/**
 * Make authenticated API request
 */
async function makeAuthenticatedRequest(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cachedAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // If 401, token might have expired, try refreshing once
    if (response.status === 401) {
      console.log('Got 401, forcing token refresh...');
      cachedAccessToken = null;
      tokenExpiresAt = 0;
      await ensureValidToken();

      // Retry request with new token
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cachedAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`API request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`);
      }

      return retryResponse;
    }

    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * Fetch current positions from Limitless API
 */
async function fetchPositions() {
  console.log('Fetching positions from Limitless API...');

  try {
    const response = await makeAuthenticatedRequest(`${LIMITLESS_API_URL}/portfolio/positions`);
    const data = await response.json();
    const positions = data.data || data.positions || data;

    console.log(`Fetched ${positions.length || 0} positions`);
    return positions;
  } catch (error) {
    console.error('Error fetching positions:', error);
    return [];
  }
}

/**
 * Fetch trades from Limitless API
 */
async function fetchTrades() {
  console.log('Fetching trades from Limitless API...');

  try {
    const response = await makeAuthenticatedRequest(`${LIMITLESS_API_URL}/portfolio/trades?page=1&limit=100`);
    const data = await response.json();
    const trades = data.data || data.trades || data;

    console.log(`Fetched ${trades.length || 0} trades`);
    return trades;
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

/**
 * Fetch points from Limitless API
 */
async function fetchPoints() {
  console.log('Fetching points from Limitless API...');

  try {
    const response = await makeAuthenticatedRequest(`${LIMITLESS_API_URL}/portfolio/points`);
    const data = await response.json();

    console.log(`Fetched points data:`, data);
    return data;
  } catch (error) {
    console.error('Error fetching points:', error);
    return null;
  }
}

/**
 * Fetch traded volume from Limitless API
 */
async function fetchTradedVolume() {
  console.log('Fetching traded volume from Limitless API...');

  try {
    const response = await makeAuthenticatedRequest(`${LIMITLESS_API_URL}/portfolio/traded-volume`);
    const data = await response.json();

    console.log(`Fetched traded volume:`, data);
    return data;
  } catch (error) {
    console.error('Error fetching traded volume:', error);
    return null;
  }
}

/**
 * Format positions data into state structure expected by dashboard
 */
function formatState(positions) {
  if (!positions || positions.length === 0) {
    return {};
  }

  const state = {
    wallet1: {
      holdings: positions.map(position => ({
        marketAddress: position.marketAddress || position.market_address || '',
        marketTitle: position.marketTitle || position.market_title || position.title || 'Unknown Market',
        outcomeIndex: position.outcomeIndex ?? position.outcome_index ?? null,
        tokenId: position.tokenId || position.token_id || null,
        amount: position.amount || position.balance || '0',
        cost: position.cost || position.investment || '0',
        strategy: position.strategy || 'unknown',
        entryPrice: position.entryPrice || position.entry_price || position.price || '0',
        buyTimestamp: position.buyTimestamp || position.created_at || new Date().toISOString(),
        marketDeadline: position.marketDeadline || position.deadline || null,
        buyTxHash: position.txHash || position.transaction_hash || '',
      }))
    }
  };

  return state;
}

/**
 * Calculate statistics from trades
 */
function calculateStats(trades, points, volume) {
  const now = Date.now();

  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0,
      totalProfitUSDC: 0,
      totalLossUSDC: 0,
      netProfitUSDC: 0,
      winRate: '0.00%',
      uptimeHours: '0.00',
      startTime: now,
      lastUpdated: now,
      points: points || 0,
      tradedVolume: volume || 0,
    };
  }

  const completedTrades = trades.filter(t =>
    t.type === 'SELL_PROFIT' ||
    t.type === 'SELL_STOP_LOSS' ||
    t.type === 'REDEEM' ||
    t.status === 'completed' ||
    t.status === 'closed'
  );

  const profitableTrades = completedTrades.filter(t => {
    const pnl = parseFloat(t.pnlUSDC || t.pnl || t.profit || '0');
    return pnl > 0 || t.result === 'WON';
  });

  const losingTrades = completedTrades.filter(t => {
    const pnl = parseFloat(t.pnlUSDC || t.pnl || t.profit || '0');
    return pnl < 0 || t.result === 'LOST';
  });

  const totalProfit = profitableTrades.reduce((sum, t) => {
    return sum + Math.abs(parseFloat(t.pnlUSDC || t.pnl || t.profit || '0'));
  }, 0);

  const totalLoss = losingTrades.reduce((sum, t) => {
    return sum + Math.abs(parseFloat(t.pnlUSDC || t.pnl || t.profit || '0'));
  }, 0);

  const netProfit = totalProfit - totalLoss;
  const winRate = completedTrades.length > 0
    ? ((profitableTrades.length / completedTrades.length) * 100).toFixed(2)
    : '0.00';

  const startTime = trades.length > 0
    ? new Date(trades[0].timestamp || trades[0].created_at).getTime()
    : now;
  const uptimeMs = now - startTime;
  const uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(2);

  return {
    totalTrades: completedTrades.length,
    profitableTrades: profitableTrades.length,
    losingTrades: losingTrades.length,
    totalProfitUSDC: parseFloat(totalProfit.toFixed(2)),
    totalLossUSDC: parseFloat(totalLoss.toFixed(2)),
    netProfitUSDC: parseFloat(netProfit.toFixed(2)),
    winRate: winRate + '%',
    uptimeHours: uptimeHours,
    startTime: startTime,
    lastUpdated: now,
    points: points,
    tradedVolume: volume,
  };
}

/**
 * Format trades as JSONL (one JSON object per line)
 */
function formatTradesAsJsonl(trades) {
  if (!trades || trades.length === 0) return '';
  return trades.map(trade => JSON.stringify(trade)).join('\n');
}

/**
 * Upload content to S3
 */
async function uploadToS3(key, content) {
  console.log(`Uploading ${key} to S3...`);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: content,
    ContentType: key.endsWith('.json') ? 'application/json' : 'application/x-ndjson',
    CacheControl: 'no-cache, no-store, must-revalidate',
  });

  await s3Client.send(command);
  console.log(`Successfully uploaded ${key}`);
}
