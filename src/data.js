import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const googleBridgePath = path.join(__dirname, 'google_ads_bridge.py');
const metaBridgePath = path.join(__dirname, 'meta_ads_bridge.py');
const pythonPath = '/opt/openclaw/workspace/google-ads/.venv/bin/python';

function runBridge(scriptPath, args) {
  const result = spawnSync(pythonPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Bridge failed');
  }
  return JSON.parse(result.stdout || 'null');
}

export function getAccounts() {
  const google = runBridge(googleBridgePath, ['accounts']).map((a) => ({ ...a, id: `google:${a.id}`, source: 'google' }));
  const meta = runBridge(metaBridgePath, ['accounts']).map((a) => ({ ...a, id: `meta:${a.id}`, source: 'meta' }));
  return [...google, ...meta];
}

export function getAccount(accountId) {
  const [source, rawId] = String(accountId).includes(':') ? String(accountId).split(':', 2) : ['google', String(accountId)];
  if (source === 'meta') {
    const summary = runBridge(metaBridgePath, ['summary', rawId]);
    const campaignList = runBridge(metaBridgePath, ['campaigns', rawId]) || [];
    return { ...summary, id: `meta:${rawId}`, campaigns: campaignList };
  }
  const summary = runBridge(googleBridgePath, ['summary', rawId]);
  const campaignList = runBridge(googleBridgePath, ['campaigns', rawId]) || [];
  return { ...summary, id: `google:${rawId}`, campaigns: campaignList };
}

export function getCampaign(accountId, campaignId) {
  const [source, rawId] = String(accountId).includes(':') ? String(accountId).split(':', 2) : ['google', String(accountId)];
  if (source === 'meta') {
    return runBridge(metaBridgePath, ['campaign', rawId, campaignId]);
  }
  return runBridge(googleBridgePath, ['campaign', rawId, campaignId]);
}
