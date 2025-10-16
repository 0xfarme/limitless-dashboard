const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { ethers } = require('ethers');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'limitless-bot-logs';
const LIMITLESS_API_URL = 'https://api.limitless.exchange';

// Wallet authentication (set in Lambda environment variables)
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Store session cookie in memory (persists between Lambda warm starts)
let cachedSessionCookie = null;
let sessionExpiresAt = 0;

/**
 * Lambda handler that fetches data from Limitless Exchange API and uploads to S3
 */
exports.handler = async (event) => {
  console.log('Starting trade file generation from Limitless API...');

  try {
    // Ensure we have a valid session
    await ensureValidSession();

    // Fetch data from Limitless Exchange API
    const positions = await fetchPositions();
    const tradesRaw = await fetchTrades();
    const points = await fetchPoints();
    // Volume will be calculated from trades, not from a separate endpoint
    const volume = null;

    // Sort trades by timestamp descending (newest first)
    const trades = tradesRaw.sort((a, b) => {
      const timeA = parseInt(a.blockTimestamp || '0');
      const timeB = parseInt(b.blockTimestamp || '0');
      return timeB - timeA;
    });

    // Calculate statistics from trades
    const stats = calculateStats(trades, points, volume);

    // Format state from positions
    const state = formatState(positions);

    // Update points history with current data
    const updatedPointsHistory = await updatePointsHistory(points, volume);

    // Calculate and update weekly summary
    const weeklySummary = calculateWeeklySummary(trades);

    // Upload files to S3
    await Promise.all([
      uploadToS3('trades.jsonl', formatTradesAsJsonl(trades)),
      uploadToS3('stats.json', JSON.stringify(stats, null, 2)),
      uploadToS3('state.json', JSON.stringify(state, null, 2)),
      uploadToS3('points_hist.json', JSON.stringify(updatedPointsHistory, null, 2)),
      uploadToS3('weekly_summary.json', JSON.stringify(weeklySummary, null, 2)),
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
 * Convert string to hex with 0x prefix
 */
function stringToHex(text) {
  return '0x' + Buffer.from(text, 'utf-8').toString('hex');
}

/**
 * Get signing message from Limitless API
 */
async function getSigningMessage() {
  const response = await fetch(`${LIMITLESS_API_URL}/auth/signing-message`);
  if (!response.ok) {
    throw new Error(`Failed to get signing message: ${response.status}`);
  }
  return await response.text();
}

/**
 * Authenticate with Limitless Exchange using wallet signature
 */
async function authenticate() {
  console.log('Authenticating with Limitless Exchange...');

  // Create wallet from private key
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const address = wallet.address;
  console.log(`Using wallet address: ${address}`);

  // Get signing message
  const signingMessage = await getSigningMessage();
  console.log(`Signing message: ${signingMessage}`);

  // Sign the message
  const signature = await wallet.signMessage(signingMessage);
  console.log(`Signature created: ${signature.substring(0, 10)}...`);

  // Convert message to hex
  const hexMessage = stringToHex(signingMessage);

  // Prepare headers
  const headers = {
    'x-account': address,
    'x-signing-message': hexMessage,
    'x-signature': signature,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Login request
  const response = await fetch(`${LIMITLESS_API_URL}/auth/login`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ client: 'eoa' }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
  }

  // Extract session cookie
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No session cookie received');
  }

  // Parse the limitless_session cookie
  const cookieMatch = setCookieHeader.match(/limitless_session=([^;]+)/);
  if (!cookieMatch) {
    throw new Error('Could not extract session cookie');
  }

  const sessionCookie = cookieMatch[1];
  console.log('Authentication successful, session cookie obtained');

  return sessionCookie;
}

/**
 * Ensure we have a valid session, re-authenticate if needed
 */
async function ensureValidSession() {
  const now = Date.now();

  // If session is still valid (with 10 minute buffer), use cached session
  if (cachedSessionCookie && sessionExpiresAt > now + 600000) {
    console.log('Using cached session cookie');
    return;
  }

  console.log('Session expired or not found, authenticating...');

  // Authenticate and get new session
  cachedSessionCookie = await authenticate();

  // Sessions typically last 24 hours, but we'll refresh after 23 hours to be safe
  sessionExpiresAt = now + (23 * 60 * 60 * 1000);

  console.log('Session refreshed successfully');
}

/**
 * Make authenticated API request using session cookie
 */
async function makeAuthenticatedRequest(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `limitless_session=${cachedSessionCookie}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // If 401, session might have expired, try re-authenticating once
    if (response.status === 401) {
      console.log('Got 401, forcing re-authentication...');
      cachedSessionCookie = null;
      sessionExpiresAt = 0;
      await ensureValidSession();

      // Retry request with new session
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': `limitless_session=${cachedSessionCookie}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`API request failed after retry: ${retryResponse.status} ${await retryResponse.text()}`);
      }

      return retryResponse;
    }

    throw new Error(`API request failed: ${response.status} ${await response.text()}`);
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
    return Array.isArray(positions) ? positions : [];
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
    return Array.isArray(trades) ? trades : [];
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

    console.log('Raw points API response:', JSON.stringify(data));
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

    console.log(`Fetched traded volume`);
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
 * Calculate statistics from trades (raw API format)
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

  // Filter for closed/resolved markets only
  const completedTrades = trades.filter(t =>
    t.market?.closed === true &&
    t.market?.winningOutcomeIndex !== undefined &&
    t.market?.winningOutcomeIndex !== null
  );

  let totalProfit = 0;
  let totalLoss = 0;
  let profitableCount = 0;
  let losingCount = 0;
  let totalVolumeUSDC = 0;

  completedTrades.forEach(trade => {
    const decimals = trade.market?.collateral?.decimals || 6;
    const cost = parseFloat(trade.outcomeTokenNetCost || '0') / Math.pow(10, decimals);
    const outcomeAmount = parseFloat(trade.outcomeTokenAmount || '0');
    const wonTrade = trade.market.winningOutcomeIndex === trade.outcomeIndex;

    // Calculate P&L
    let pnl = 0;
    if (wonTrade) {
      // Won: get back the outcome token amount as USDC
      pnl = outcomeAmount - cost;
    } else {
      // Lost: lose the entire cost
      pnl = -cost;
    }

    // A winning trade is one where you made profit (outcomeTokenAmount > cost)
    if (pnl > 0) {
      profitableCount++;
      totalProfit += pnl;
    } else if (pnl < 0) {
      losingCount++;
      totalLoss += Math.abs(pnl);
    }
    // If pnl == 0, don't count as win or loss

    // Track total volume
    totalVolumeUSDC += cost;
  });

  const netProfit = totalProfit - totalLoss;
  const winRate = completedTrades.length > 0
    ? ((profitableCount / completedTrades.length) * 100).toFixed(2)
    : '0.00';

  // Calculate uptime
  let startTime = now;
  let uptimeHours = '0.00';

  if (trades.length > 0) {
    const timestamps = trades
      .map(t => parseInt(t.blockTimestamp) * 1000)
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length > 0) {
      startTime = timestamps[0];
      const uptimeMs = now - startTime;
      uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(2);
    }
  }

  return {
    totalTrades: completedTrades.length,
    profitableTrades: profitableCount,
    losingTrades: losingCount,
    totalProfitUSDC: parseFloat(totalProfit.toFixed(2)),
    totalLossUSDC: parseFloat(totalLoss.toFixed(2)),
    netProfitUSDC: parseFloat(netProfit.toFixed(2)),
    winRate: winRate + '%',
    uptimeHours: uptimeHours,
    startTime: startTime,
    lastUpdated: now,
    points: points,
    tradedVolume: volume || { total: totalVolumeUSDC },
  };
}

/**
 * Calculate weekly summary to avoid processing all trades every time
 */
function calculateWeeklySummary(trades) {
  if (!trades || trades.length === 0) return [];

  const weeklyData = {};

  // Group trades by week
  trades.forEach(trade => {
    if (!trade.market?.closed || trade.market?.winningOutcomeIndex === undefined) {
      return; // Skip open trades
    }

    const tradeDate = new Date(parseInt(trade.blockTimestamp) * 1000);
    // Get start of week (Monday)
    const dayOfWeek = tradeDate.getDay();
    const diff = tradeDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(tradeDate.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStart: weekKey,
        trades: 0,
        wins: 0,
        losses: 0,
        profitUSDC: 0,
        lossUSDC: 0,
        netProfitUSDC: 0,
        volumeUSDC: 0,
      };
    }

    const week = weeklyData[weekKey];
    const decimals = trade.market?.collateral?.decimals || 6;
    const cost = parseFloat(trade.outcomeTokenNetCost || '0') / Math.pow(10, decimals);
    const outcomeAmount = parseFloat(trade.outcomeTokenAmount || '0');
    const wonTrade = trade.market.winningOutcomeIndex === trade.outcomeIndex;

    week.trades++;
    week.volumeUSDC += cost;

    if (wonTrade) {
      const pnl = outcomeAmount - cost;
      week.wins++;
      week.profitUSDC += pnl;
      week.netProfitUSDC += pnl;
    } else {
      week.losses++;
      week.lossUSDC += cost;
      week.netProfitUSDC -= cost;
    }
  });

  // Convert to array and sort by week start date (newest first)
  return Object.values(weeklyData).sort((a, b) =>
    new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );
}

/**
 * Format trades as JSONL (one JSON object per line)
 */
function formatTradesAsJsonl(trades) {
  if (!trades || trades.length === 0) return '';
  return trades.map(trade => JSON.stringify(trade)).join('\n');
}

/**
 * Fetch existing points history from S3
 */
async function fetchPointsHistory() {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'points_hist.json',
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body.transformToString();
    return JSON.parse(bodyString);
  } catch (error) {
    // File doesn't exist yet, return empty array
    console.log('No existing points history found, starting fresh');
    return [];
  }
}

/**
 * Calculate weekly volume from trades
 */
async function calculateWeeklyVolume(trades) {
  if (!trades || trades.length === 0) return 0;

  // Get trades from the last 7 days
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  const recentTrades = trades.filter(t => {
    const timestamp = new Date(t.timestamp || t.created_at || t.blockTimestamp).getTime();
    return timestamp >= weekAgo;
  });

  // Sum up the volume
  return recentTrades.reduce((sum, trade) => {
    const cost = parseFloat(trade.outcomeTokenNetCost || trade.costUSDC || trade.cost || '0');
    // Convert from wei to USDC (6 decimals) if needed
    const normalizedCost = cost > 1000000 ? cost / Math.pow(10, 6) : cost;
    return sum + normalizedCost;
  }, 0);
}

/**
 * Update points history with current data
 * Appends a new entry with current date, points, and volume
 */
async function updatePointsHistory(points, volume) {
  console.log('Updating points history...');

  const history = await fetchPointsHistory();
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

  // Extract points data
  const season1 = points?.season1 || points?.data?.season1 || 0;
  const season2 = points?.season2 || points?.data?.season2 || 0;
  const currentMonth = points?.currentMonth || points?.data?.currentMonth || 0;

  // Extract volume data
  const totalVolume = volume?.total || volume?.data?.total || volume || 0;

  // Check if we already have an entry for today
  const existingEntryIndex = history.findIndex(entry => entry.date === currentDate);

  const newEntry = {
    date: currentDate,
    season1,
    season2,
    currentMonth,
    volume: totalVolume,
    lastUpdated: now.toISOString(),
  };

  if (existingEntryIndex >= 0) {
    // Update existing entry for today
    console.log(`Updating existing entry for ${currentDate}`);
    history[existingEntryIndex] = newEntry;
  } else {
    // Add new entry
    console.log(`Adding new entry for ${currentDate}`);
    history.push(newEntry);
  }

  // Sort by date ascending
  history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log(`Points history now has ${history.length} entries`);
  return history;
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
