import { getAccount, getAccounts, getCampaign, getSearchTerms } from './data.js';

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

function pad(value, width) {
  const text = String(value ?? '');
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function clip(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function getSession(chatId) {
  let session = sessionStore.get(chatId);
  if (!session) {
    session = { screen: 'picker', accountId: null, campaignId: null, campaignsView: 'cards' };
    sessionStore.set(chatId, session);
  }
  return session;
}

function buildPickerScreen() {
  const items = getAccounts().slice(0, 20);
  const googleCount = items.filter((a) => a.platform === 'Google Ads').length;
  const metaCount = items.filter((a) => a.platform === 'Meta Ads').length;
  return {
    text: [
      '✨ Ads Navigator',
      '',
      'Choose an account to inspect.',
      'Read only mode is on.',
      '',
      `Google: ${googleCount} | Meta: ${metaCount}`,
      `Showing: ${items.length} accounts`,
    ].join('\n'),
    reply_markup: keyboard(items.map((account, index) => [button(`${index + 1}. ${platformIcon(account.platform)} ${clip(account.name, 30)}`, `pick:${account.id}`)])),
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
      `💰 Spend: ${formatMoney(account.summary.spend, account.currency)}`,
      `👆 Clicks: ${account.summary.clicks}`,
      `${convTone} Conversions: ${account.summary.conversions}`,
      `${cpaTone} CPA: ${formatMoney(account.summary.cpa, account.currency)}`,
      `📈 CTR: ${account.summary.ctr}%`,
      '',
      `🟢 Active campaigns: ${account.summary.activeCampaigns}`,
      `⏸️ Paused campaigns: ${account.summary.pausedCampaigns}`,
      '',
      `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('📋 Campaigns', `screen:campaigns:${account.id}`), button('🔄 Refresh', `screen:account:${account.id}`)],
      [button('🏠 Home', 'screen:picker')],
    ]),
  };
}

function buildCampaignCards(account, campaigns) {
  return [
    `📋 ${account.name}`,
    `${account.platform} campaigns | Last 30 days`,
    'View: Cards',
    '',
    ...campaigns.map((campaign, index) => `${index + 1}. ${campaign.name}\n${campaignLabel(campaign)} | Spend ${formatMoney(campaign.spend, account.currency)} | Conv ${campaign.conversions} | CPA ${formatMoney(campaign.cpa, account.currency)}`),
    '',
    `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
  ].join('\n');
}

function buildCampaignTable(account, campaigns) {
  const lines = [
    `📊 ${account.name}`,
    `${account.platform} campaigns | Table`,
    '',
    '```',
    `${pad('#', 2)} ${pad('Campaign', 22)} ${pad('Spend', 7)} ${pad('Conv', 5)} ${pad('CPA', 7)} ${pad('Flag', 6)}`,
  ];
  campaigns.forEach((campaign, index) => {
    lines.push(`${pad(index + 1, 2)} ${pad(clip(campaign.name, 22), 22)} ${pad(formatMoney(campaign.spend, account.currency), 7)} ${pad(campaign.conversions, 5)} ${pad(formatMoney(campaign.cpa, account.currency), 7)} ${pad(campaignLabel(campaign).split(' ')[0], 6)}`);
  });
  lines.push('```', '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`);
  return lines.join('\n');
}

function buildCampaignListScreen(chatId, accountId) {
  const session = getSession(chatId);
  const account = getAccount(accountId);
  if (!account) return buildPickerScreen();
  const campaigns = (account.campaigns || []).slice(0, 5);
  const text = session.campaignsView === 'table'
    ? buildCampaignTable(account, campaigns)
    : buildCampaignCards(account, campaigns);
  return {
    text,
    reply_markup: keyboard([
      campaigns.map((campaign, index) => button(String(index + 1), `camp:${account.id}:${campaign.id}`)),
      [button(session.campaignsView === 'table' ? '🧾 Cards' : '📊 Table', `toggle:campaigns:${account.id}`), button('🔄 Refresh', `screen:campaigns:${account.id}`)],
      [button('◀️ Back', `screen:account:${account.id}`), button('🏠 Home', 'screen:picker')],
    ]),
  };
}

function buildSearchTermsScreen(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  const terms = getSearchTerms(accountId, campaignId).slice(0, 8);
  if (!account || !campaign) return buildAccountScreen(accountId);
  if (account.platform !== 'Google Ads') {
    return {
      text: [`🔎 Search Terms`, '', 'Search terms are available only for Google Ads right now.', '', `Campaign: ${campaign.name}`].join('\n'),
      reply_markup: keyboard([
        [button('◀️ Back to campaign', `camp:${account.id}:${campaign.id}`)],
        [button('🏠 Home', 'screen:picker')],
      ]),
    };
  }
  const lines = [
    '🔎 Search Terms',
    campaign.name,
    '',
    '```',
    `${pad('#', 2)} ${pad('Term', 26)} ${pad('Spend', 7)} ${pad('Clk', 4)} ${pad('Conv', 5)}`,
  ];
  if (terms.length) {
    terms.forEach((term, index) => {
      lines.push(`${pad(index + 1, 2)} ${pad(clip(term.term, 26), 26)} ${pad(formatMoney(term.spend, account.currency), 7)} ${pad(term.clicks, 4)} ${pad(term.conversions, 5)}`);
    });
  } else {
    lines.push('No search term rows found.');
  }
  lines.push('```', '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`);
  return {
    text: lines.join('\n'),
    reply_markup: keyboard([
      [button('🔄 Refresh', `terms:${account.id}:${campaign.id}`)],
      [button('◀️ Campaign', `camp:${account.id}:${campaign.id}`), button('📋 Campaigns', `screen:campaigns:${account.id}`)],
      [button('🏠 Home', 'screen:picker')],
    ]),
  };
}

function buildCampaignDetailScreen(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return buildAccountScreen(accountId);
  return {
    text: [
      `🎯 ${campaign.name}`,
      `${account.platform} | Last 30 days`,
      '',
      `Status: ${campaign.status}`,
      `Type: ${campaign.type}`,
      `Bidding: ${campaign.bidding}`,
      '',
      `💰 Spend: ${formatMoney(campaign.spend, account.currency)}`,
      `👆 Clicks: ${campaign.clicks}`,
      `🎯 Conversions: ${campaign.conversions}`,
      `CPA: ${formatMoney(campaign.cpa, account.currency)}`,
      `CTR: ${campaign.ctr}%`,
      `Avg CPC: ${formatMoney(campaign.avgCpc, account.currency)}`,
      `Daily budget: ${formatMoney(campaign.budgetDaily, account.currency)}`,
      '',
      `Assessment: ${campaignLabel(campaign)}`,
      `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('🔎 Search Terms', `terms:${account.id}:${campaign.id}`), button('🔄 Refresh', `camp:${account.id}:${campaign.id}`)],
      [button('📋 Campaigns', `screen:campaigns:${account.id}`), button('◀️ Account', `screen:account:${account.id}`)],
      [button('🏠 Home', 'screen:picker')],
    ]),
  };
}

export function renderScreen(chatId) {
  const session = getSession(chatId);
  if (session.screen === 'account' && session.accountId) return buildAccountScreen(session.accountId);
  if (session.screen === 'campaigns' && session.accountId) return buildCampaignListScreen(chatId, session.accountId);
  if (session.screen === 'campaign' && session.accountId && session.campaignId) return buildCampaignDetailScreen(session.accountId, session.campaignId);
  if (session.screen === 'terms' && session.accountId && session.campaignId) return buildSearchTermsScreen(session.accountId, session.campaignId);
  return buildPickerScreen();
}

export function openAds(chatId) {
  const session = getSession(chatId);
  session.screen = 'picker';
  session.accountId = null;
  session.campaignId = null;
  session.campaignsView = 'cards';
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
    session.screen = 'account';
    session.accountId = callbackData.slice('pick:'.length);
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
  if (callbackData.startsWith('toggle:campaigns:')) {
    session.screen = 'campaigns';
    session.accountId = callbackData.slice('toggle:campaigns:'.length);
    session.campaignsView = session.campaignsView === 'table' ? 'cards' : 'table';
    return renderScreen(chatId);
  }
  if (callbackData.startsWith('terms:')) {
    const rest = callbackData.slice('terms:'.length);
    const lastColon = rest.lastIndexOf(':');
    session.screen = 'terms';
    session.accountId = rest.slice(0, lastColon);
    session.campaignId = rest.slice(lastColon + 1);
    return renderScreen(chatId);
  }
  if (callbackData.startsWith('camp:')) {
    const rest = callbackData.slice('camp:'.length);
    const lastColon = rest.lastIndexOf(':');
    session.screen = 'campaign';
    session.accountId = rest.slice(0, lastColon);
    session.campaignId = rest.slice(lastColon + 1);
    return renderScreen(chatId);
  }
  return renderScreen(chatId);
}

export function resetSessions() {
  sessionStore.clear();
}
