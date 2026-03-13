import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bridgePath = path.join(__dirname, 'google_ads_bridge.py');
const pythonPath = '/opt/openclaw/workspace/google-ads/.venv/bin/python';

const fallbackAccounts = [
  {
    id: '2910561991',
    name: 'ScreamWorks',
    platform: 'Google Ads',
    currency: 'GBP',
    lastUpdated: '2026-03-13T09:55:00Z',
    summary: {
      spend: 3547,
      clicks: 7340,
      conversions: 96,
      cpa: 36.95,
      ctr: 8.1,
      activeCampaigns: 6,
      pausedCampaigns: 22,
    },
    campaigns: [],
  },
];

function runBridge(args) {
  const result = spawnSync(pythonPath, [bridgePath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Bridge failed');
  }
  return JSON.parse(result.stdout || 'null');
}

export function getAccounts() {
  try {
    return runBridge(['accounts']);
  } catch {
    return fallbackAccounts;
  }
}

export function getAccount(accountId) {
  try {
    const summary = runBridge(['summary', accountId]);
    const campaignList = runBridge(['campaigns', accountId]) || [];
    return { ...summary, campaigns: campaignList };
  } catch {
    return fallbackAccounts.find((account) => account.id === accountId) || null;
  }
}

export function getCampaign(accountId, campaignId) {
  try {
    return runBridge(['campaign', accountId, campaignId]);
  } catch {
    const account = fallbackAccounts.find((item) => item.id === accountId);
    return account?.campaigns?.find((campaign) => campaign.id === campaignId) || null;
  }
}
