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

export async function fetchTrades(): Promise<Trade[]> {
  try {
    const data = await fetchFile('trades.jsonl');
    return data
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Trade);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

export async function fetchStats(): Promise<Stats | null> {
  try {
    const data = await fetchFile('stats.json');
    return JSON.parse(data) as Stats;
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
