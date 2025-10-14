export interface Trade {
  timestamp: string;
  type: 'BUY' | 'SELL_PROFIT' | 'SELL_STOP_LOSS' | 'REDEEM';
  wallet: string;
  marketAddress: string;
  marketTitle: string;
  outcome?: number;
  outcomePrice?: string;
  investmentUSDC?: string;
  costUSDC?: string;
  returnUSDC?: string;
  redeemedUSDC?: string;
  pnlUSDC?: string;
  pnlPercent?: string;
  strategy?: string;
  txHash: string;
  result?: 'WON' | 'LOST';
}

export interface Stats {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  totalProfitUSDC: number;
  totalLossUSDC: number;
  netProfitUSDC: number;
  winRate: string;
  uptimeHours: string;
  startTime: number;
  lastUpdated: number;
}

export interface Holding {
  marketAddress: string;
  marketTitle?: string;
  outcomeIndex: number | null;
  tokenId: string | null;
  amount: string | null;
  cost: string | null;
  strategy?: string;
  entryPrice?: string;
  buyTimestamp?: string;
  marketDeadline?: string | number | null;
  buyTxHash?: string;
}

export interface RedemptionLog {
  timestamp: string;
  event: string;
  wallet: string;
  marketAddress?: string;
  [key: string]: any;
}
