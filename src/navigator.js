import { getAccount, getAccounts, getCampaign } from './data.js';

const sessionStore = new Map();

function formatMoney(amount, currency) {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${Number(amount).toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatUpdated(iso, platform = 'API') {
  if (!iso) return `Live ${platform}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Live ${platform}`;
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function button(text, data) {
  return { text, callback_data: data };
}

function platformIcon(platform) {
  if (platform === 'Google Ads') return '🔎';
  if (platform === 'Meta Ads') return '📘';
  return '📊';
}

function metricTone(value, { goodHigh = true } = {}) {
  if (value === null || value === undefined) return '•';
  if (goodHigh) {
    if (value >= 15) return '🟢';
    if (value >= 5) return '🟡';
    return '🔴';
  }
  if (value <= 25) return '🟢';
  if (value <= 75) return '🟡';
  return '🔴';
}

function campaignLabel(campaign) {
  if ((campaign.conversions || 0) >= 10 && (campaign.cpa || 0) > 0 && campaign.cpa <= 25) return '🟢 strong';
  if ((campaign.conversions || 0) >= 3) return '🟡 mixed';
  return '🔴 watch';
}

function getSession(chatId) {
  let session = sessionStore.get(chatId);
  if (!session) {
    session = { screen: 'picker', accountId: null, campaignId: null };
    sessionStore.set(chatId, session);
  }
  return session;
}

function buildPickerScreen() {
  const items = getAccounts().slice(0, 20);
  return {
    text: [
      '📊 Ads Navigator',
      '',
      'Choose an account.',
      'Read only mode is on.',
      '',
      `Accounts loaded: ${items.length}`,
    ].join('\n'),
    reply_markup: keyboard(items.map((account, index) => [button(`${index + 1}. ${platformIcon(account.platform)} ${account.name}`, `pick:${account.id}`)])),
  };
}

function buildAccountScreen(accountId) {
  const account = getAccount(accountId);
  if (!account) return buildPickerScreen();
  const convTone = metricTone(account.summary.conversions, { goodHigh: true });
  const cpaTone = metricTone(account.summary.cpa, { goodHigh: false });
  return {
    text: [
      `${platformIcon(account.platform)} ${account.name}`,
      `${account.platform} | Last 30 days`,
      '',
      `Spend: ${formatMoney(account.summary.spend, account.currency)}`,
      `Clicks: ${account.summary.clicks}`,
      `${convTone} Conversions: ${account.summary.conversions}`,
      `${cpaTone} CPA: ${formatMoney(account.summary.cpa, account.currency)}`,
      `CTR: ${account.summary.ctr}%`,
      '',
      `Active campaigns: ${account.summary.activeCampaigns}`,
      `Paused campaigns: ${account.summary.pausedCampaigns}`,
      '',
      `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('Campaigns', `screen:campaigns:${account.id}`), button('Refresh', `screen:account:${account.id}`)],
      [button('Home', 'screen:picker')],
    ]),
  };
}

function buildCampaignListScreen(accountId) {
  const account = getAccount(accountId);
  if (!account) return buildPickerScreen();
  const campaigns = (account.campaigns || []).slice(0, 5);
  return {
    text: [
      `📋 ${account.name}`,
      `${account.platform} campaigns | Last 30 days`,
      '',
      ...campaigns.map((campaign, index) => `${index + 1}. ${campaign.name}\n${campaignLabel(campaign)} | Spend ${formatMoney(campaign.spend, account.currency)} | Conv ${campaign.conversions} | CPA ${formatMoney(campaign.cpa, account.currency)}`),
      '',
      `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
    ].join('\n'),
    reply_markup: keyboard([
      campaigns.map((campaign, index) => button(String(index + 1), `camp:${account.id}:${campaign.id}`)),
      [button('Refresh', `screen:campaigns:${account.id}`), button('Back', `screen:account:${account.id}`)],
      [button('Home', 'screen:picker')],
    ]),
  };
}

function buildCampaignDetailScreen(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return buildCampaignListScreen(accountId);
  return {
    text: [
      `🎯 ${campaign.name}`,
      `${account.platform} | Last 30 days`,
      '',
      `Status: ${campaign.status}`,
      `Type: ${campaign.type}`,
      `Bidding: ${campaign.bidding}`,
      '',
      `Spend: ${formatMoney(campaign.spend, account.currency)}`,
      `Clicks: ${campaign.clicks}`,
      `Conversions: ${campaign.conversions}`,
      `CPA: ${formatMoney(campaign.cpa, account.currency)}`,
      `CTR: ${campaign.ctr}%`,
      `Avg CPC: ${formatMoney(campaign.avgCpc, account.currency)}`,
      `Daily budget: ${formatMoney(campaign.budgetDaily, account.currency)}`,
      '',
      `Assessment: ${campaignLabel(campaign)}`,
      `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('Refresh', `camp:${account.id}:${campaign.id}`)],
      [button('Back to campaigns', `screen:campaigns:${account.id}`), button('Back to account', `screen:account:${account.id}`)],
      [button('Home', 'screen:picker')],
    ]),
  };
}

export function renderScreen(chatId) {
  const session = getSession(chatId);
  if (session.screen === 'account' && session.accountId) return buildAccountScreen(session.accountId);
  if (session.screen === 'campaigns' && session.accountId) return buildCampaignListScreen(session.accountId);
  if (session.screen === 'campaign' && session.accountId && session.campaignId) return buildCampaignDetailScreen(session.accountId, session.campaignId);
  return buildPickerScreen();
}

export function openAds(chatId) {
  const session = getSession(chatId);
  session.screen = 'picker';
  session.accountId = null;
  session.campaignId = null;
  return renderScreen(chatId);
}

export function handleCallback(chatId, callbackData) {
  const session = getSession(chatId);

  if (callbackData === 'screen:picker') {
    session.screen = 'picker';
    session.accountId = null;
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('pick:')) {
    const accountId = callbackData.slice('pick:'.length);
    session.screen = 'account';
    session.accountId = accountId;
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('screen:account:')) {
    session.screen = 'account';
    session.accountId = callbackData.slice('screen:account:'.length);
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('screen:campaigns:')) {
    session.screen = 'campaigns';
    session.accountId = callbackData.slice('screen:campaigns:'.length);
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('camp:')) {
    const rest = callbackData.slice('camp:'.length);
    const lastColon = rest.lastIndexOf(':');
    const accountId = rest.slice(0, lastColon);
    const campaignId = rest.slice(lastColon + 1);
    session.screen = 'campaign';
    session.accountId = accountId;
    session.campaignId = campaignId;
    return renderScreen(chatId);
  }

  return renderScreen(chatId);
}

export function resetSessions() {
  sessionStore.clear();
}
