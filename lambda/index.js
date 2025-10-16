const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { ethers } = require('ethers');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'limitless-bot-logs';
const LIMITLESS_API_URL = 'https://api.limitless.exchange';

// Wallet authentication (set in Lambda environment variables)
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Store session cookie and wallet address in memory (persists between Lambda warm starts)
let cachedSessionCookie = null;
let sessionExpiresAt = 0;
let walletAddress = null;

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
    const trades = await fetchTrades();
    const points = await fetchPoints();
    const volume = await fetchTradedVolume(walletAddress);

    // Calculate statistics from trades
    const stats = calculateStats(trades, points, volume);

    // Format state from positions
    const state = formatState(positions);

    // Update daily volume and points history
    const volumeHistory = await updateDailyVolume(volume);
    const pointsHistory = await updateDailyPoints(points);

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
  walletAddress = address; // Store for later use
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

    console.log(`Fetched points data`);
    return data;
  } catch (error) {
    console.error('Error fetching points:', error);
    return null;
  }
}

/**
 * Fetch traded volume from Limitless API
 */
async function fetchTradedVolume(walletAddress) {
  console.log('Fetching traded volume from Limitless API...');

  try {
    const response = await makeAuthenticatedRequest(`${LIMITLESS_API_URL}/portfolio/${walletAddress}/traded-volume`);
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
 * Get file from S3
 */
async function getFromS3(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    return content;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
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

/**
 * Update daily volume history
 */
async function updateDailyVolume(volumeData) {
  console.log('Updating daily volume history...');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const currentVolume = parseFloat(volumeData?.data || volumeData?.totalVolume || volumeData?.volume || 0);

  // Get existing history
  let history = [];
  const existingData = await getFromS3('volume-history.json');
  if (existingData) {
    try {
      history = JSON.parse(existingData);
    } catch (e) {
      console.error('Error parsing existing volume history:', e);
      history = [];
    }
  }

  // Check if we already have today's entry
  const todayIndex = history.findIndex(entry => entry.date === today);

  if (todayIndex >= 0) {
    // Update today's volume
    history[todayIndex].volume = currentVolume;
    history[todayIndex].lastUpdated = new Date().toISOString();
  } else {
    // Add new entry for today
    history.push({
      date: today,
      volume: currentVolume,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Sort by date (newest first)
  history.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Keep last 90 days
  history = history.slice(0, 90);

  await uploadToS3('volume-history.json', JSON.stringify(history, null, 2));
  console.log(`Updated volume history with ${currentVolume} for ${today}`);

  return history;
}

/**
 * Update daily points history
 */
async function updateDailyPoints(pointsData) {
  console.log('Updating daily points history...');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const season1 = parseFloat(pointsData?.season1 || 0);
  const season2 = parseFloat(pointsData?.season2 || 0);
  const currentMonth = parseFloat(pointsData?.currentMonth || 0);

  // Get existing history
  let history = [];
  const existingData = await getFromS3('points-history.json');
  if (existingData) {
    try {
      history = JSON.parse(existingData);
    } catch (e) {
      console.error('Error parsing existing points history:', e);
      history = [];
    }
  }

  // Check if we already have today's entry
  const todayIndex = history.findIndex(entry => entry.date === today);

  if (todayIndex >= 0) {
    // Update today's points
    history[todayIndex].season1 = season1;
    history[todayIndex].season2 = season2;
    history[todayIndex].currentMonth = currentMonth;
    history[todayIndex].lastUpdated = new Date().toISOString();
  } else {
    // Add new entry for today
    history.push({
      date: today,
      season1: season1,
      season2: season2,
      currentMonth: currentMonth,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Sort by date (newest first)
  history.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Keep last 90 days
  history = history.slice(0, 90);

  await uploadToS3('points-history.json', JSON.stringify(history, null, 2));
  console.log(`Updated points history with S1:${season1}, S2:${season2}, Month:${currentMonth} for ${today}`);

  return history;
}
