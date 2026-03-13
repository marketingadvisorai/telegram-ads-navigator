import {
  getAccount,
  getAccounts,
  getCampaign,
  getSearchTerms,
  getConversionActions,
  getAlerts,
  getMetaAdsets,
  getMetaAds,
} from './data.js';

const sessionStore = new Map();
const kb = (rows) => ({ inline_keyboard: rows });
const bt = (text, callbackData) => ({ text, callback_data: callbackData });

function getSession(chatId) {
  let state = sessionStore.get(chatId);
  if (!state) {
    state = {
      screen: 'picker',
      accountId: null,
      campaignId: null,
      filter: 'all',
    };
    sessionStore.set(chatId, state);
  }
  return state;
}

function normalizeAccountId(accountId) {
  if (!accountId) return null;
  const value = String(accountId);
  if (value.includes(':')) return value;
  return `google:${value}`;
}

function money(amount, currency = 'USD') {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : `${currency} `;
  const value = Number(amount || 0);
  return `${symbol}${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString('en-GB');
}

function fmtPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function shorten(text, max) {
  const value = String(text || '');
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function divider() {
  return '━━━━━━━━━━━━';
}

function updatedAt(iso, source = 'live') {
  if (!iso) return `Updated: live | Source: ${source}`;
  return `Updated: ${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC | Source: ${source}`;
}

function statusDot(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('enable') || value.includes('active')) return '🟢';
  if (value.includes('pause')) return '🟡';
  if (value.includes('end') || value.includes('remove') || value.includes('archive')) return '⚫';
  return '⚪';
}

function severityDot(level = '') {
  const value = String(level).toLowerCase();
  if (value === 'high' || value === 'critical') return '🔴';
  if (value === 'medium' || value === 'warning') return '🟡';
  return '🔵';
}

function healthDot(item) {
  const conversions = Number(item?.conversions || 0);
  const cpa = Number(item?.cpa || 0);
  const spend = Number(item?.spend || 0);

  if (conversions >= 10 && cpa > 0 && cpa <= 25) return '🟢 strong';
  if (conversions >= 3 || (spend > 0 && cpa > 0 && cpa <= 60)) return '🟡 mixed';
  return '🔴 watch';
}

function findSiblingAccount(account, allAccounts) {
  if (!account) return null;
  const targetPlatform = account.platform === 'Google Ads' ? 'Meta Ads' : 'Google Ads';
  const businessName = String(account.businessName || account.name || '').trim().toLowerCase();
  const accountName = String(account.name || '').trim().toLowerCase();

  return allAccounts.find((candidate) => {
    if (candidate.platform !== targetPlatform) return false;
    const candidateBusiness = String(candidate.businessName || candidate.name || '').trim().toLowerCase();
    const candidateName = String(candidate.name || '').trim().toLowerCase();
    return candidateBusiness === businessName || candidateName === businessName || candidateName === accountName;
  }) || null;
}

async function renderPicker(chatId) {
  const state = getSession(chatId);
  const allAccounts = getAccounts('all');
  const visibleAccounts = getAccounts(state.filter).slice(0, 20);
  const googleCount = getAccounts('google').length;
  const metaCount = getAccounts('meta').length;

  const title = state.filter === 'google'
    ? '🔎 Google Ads Navigator'
    : state.filter === 'meta'
      ? '📘 Meta Ads Navigator'
      : '✨ Ads Navigator';

  return {
    text: [
      title,
      'Read only command center',
      divider(),
      'Choose an account to inspect.',
      `Google accounts: ${googleCount}`,
      `Meta accounts: ${metaCount}`,
      '',
      `Showing: ${visibleAccounts.length} of ${allAccounts.length} accounts`,
    ].join('\n'),
    reply_markup: kb([
      [bt(state.filter === 'all' ? '• All' : 'All', 'filter:all'), bt(state.filter === 'google' ? '• Google' : 'Google', 'filter:google'), bt(state.filter === 'meta' ? '• Meta' : 'Meta', 'filter:meta')],
      ...visibleAccounts.map((account, index) => [
        bt(`${index + 1}. ${account.platform === 'Google Ads' ? '🔎' : '📘'} ${shorten(account.businessName || account.name, 26)}`, `pick:${account.id}`),
      ]),
    ]),
  };
}

async function renderAccountSummary(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  const sibling = findSiblingAccount(account, getAccounts('all'));
  const isGoogle = account.platform === 'Google Ads';

  return {
    text: [
      `${isGoogle ? '🔎' : '📘'} ${account.businessName || account.name}`,
      `${account.platform} summary`,
      divider(),
      `Spend: ${money(account.summary.spend, account.currency)}`,
      `Clicks: ${fmtInt(account.summary.clicks)}`,
      `${isGoogle ? 'Conversions' : 'Purchases'}: ${fmtInt(account.summary.conversions)}`,
      `CPA: ${money(account.summary.cpa, account.currency)}`,
      `CTR: ${fmtPct(account.summary.ctr)}`,
      '',
      'Quick view',
      `${statusDot('active')} Active campaigns: ${fmtInt(account.summary.activeCampaigns)}`,
      `${statusDot('paused')} Paused campaigns: ${fmtInt(account.summary.pausedCampaigns)}`,
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Alerts', `alerts:${account.id}`)],
      isGoogle
        ? [bt('Conversions', `convs:${account.id}`), sibling ? bt('Meta overview', `screen:account:${sibling.id}`) : bt('Refresh', `screen:account:${account.id}`)]
        : [sibling ? bt('Google summary', `screen:account:${sibling.id}`) : bt('Refresh', `screen:account:${account.id}`), bt('Refresh', `screen:account:${account.id}`)],
      [bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderCampaignList(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  const campaigns = (account.campaigns || []).slice(0, 5);
  return {
    text: [
      `${account.platform === 'Google Ads' ? '📋' : '📘'} ${account.businessName || account.name}`,
      `${account.platform} campaigns`,
      divider(),
      campaigns.length
        ? campaigns.map((campaign, index) => [
            `${index + 1}. ${statusDot(campaign.status)} ${shorten(campaign.name, 34)}`,
            `   ${healthDot(campaign)}  |  Spend ${money(campaign.spend, account.currency)}  |  Conv ${fmtInt(campaign.conversions)}  |  CPA ${money(campaign.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No campaign rows found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      campaigns.length ? campaigns.map((campaign, index) => bt(String(index + 1), `camp:${account.id}:${campaign.id}`)) : [bt('Account', `screen:account:${account.id}`)],
      [bt('Refresh', `screen:campaigns:${account.id}`), bt('Account', `screen:account:${account.id}`)],
      [bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderCampaignDetail(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  const isMeta = account.platform === 'Meta Ads';
  return {
    text: [
      `🎯 ${campaign.name}`,
      `${account.businessName || account.name}`,
      divider(),
      `${statusDot(campaign.status)} Status: ${campaign.status}`,
      `Channel: ${campaign.type}`,
      `Strategy: ${campaign.bidding}`,
      `Daily budget: ${money(campaign.budgetDaily, account.currency)}`,
      '',
      `Spend: ${money(campaign.spend, account.currency)}`,
      `Clicks: ${fmtInt(campaign.clicks)}`,
      `${isMeta ? 'Purchases' : 'Conversions'}: ${fmtInt(campaign.conversions)}`,
      `CPA: ${money(campaign.cpa, account.currency)}`,
      `CTR: ${fmtPct(campaign.ctr)}`,
      `Avg CPC: ${money(campaign.avgCpc, account.currency)}`,
      '',
      `Assessment: ${healthDot(campaign)}`,
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      isMeta
        ? [bt('Ad sets', `madsets:${account.id}:${campaign.id}`), bt('Ads', `mads:${account.id}:${campaign.id}`)]
        : [bt('Search terms', `terms:${account.id}:${campaign.id}`), bt('Conversions', `convs:${account.id}`)],
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Account', `screen:account:${account.id}`)],
      [bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderSearchTerms(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  if (account.platform !== 'Google Ads') {
    return {
      text: ['🔎 Search terms', divider(), 'Search terms are available only for Google Ads.', '', `Campaign: ${campaign.name}`].join('\n'),
      reply_markup: kb([[bt('Campaign', `camp:${account.id}:${campaign.id}`), bt('Home', 'screen:picker')]]),
    };
  }

  const terms = getSearchTerms(accountId, campaignId).slice(0, 8);
  const wasteCount = terms.filter((term) => Number(term.spend || 0) > 0 && Number(term.conversions || 0) === 0).length;

  return {
    text: [
      '🔎 Search terms',
      `${campaign.name}`,
      divider(),
      terms.length
        ? terms.map((term, index) => [
            `${index + 1}. ${shorten(term.term, 36)}`,
            `   ${Number(term.conversions || 0) > 0 ? '🟢' : '🔴'} Spend ${money(term.spend, account.currency)}  |  Clicks ${fmtInt(term.clicks)}  |  Conv ${fmtInt(term.conversions)}`,
          ].join('\n')).join('\n\n')
        : 'No search term rows found for this range.',
      '',
      wasteCount ? `Watchouts: 🔴 ${wasteCount} visible terms have zero conversions` : 'Watchouts: 🟢 No major waste in the visible rows',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Refresh', `terms:${account.id}:${campaign.id}`), bt('Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderConversions(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  if (account.platform !== 'Google Ads') {
    return {
      text: ['⚙️ Conversion actions', divider(), 'Detailed conversion actions are available only for Google Ads right now.'].join('\n'),
      reply_markup: kb([[bt('Account', `screen:account:${account.id}`), bt('Home', 'screen:picker')]]),
    };
  }

  const actions = getConversionActions(accountId).slice(0, 10);
  const primaryCount = actions.filter((action) => action.primary).length;

  return {
    text: [
      '⚙️ Conversion actions',
      `${account.businessName || account.name}`,
      divider(),
      actions.length
        ? actions.map((action, index) => `${index + 1}. ${shorten(action.name, 32)}\n   ${action.primary ? '🟢 primary' : '⚪ secondary'}  |  ${shorten(action.type, 12)}  |  ${shorten(action.category, 14)}`).join('\n\n')
        : 'No conversion actions found.',
      '',
      `Audit: ${primaryCount > 5 ? '🟡' : '🟢'} ${primaryCount} visible actions are primary`,
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Refresh', `convs:${account.id}`), bt('Account', `screen:account:${account.id}`)],
      [bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderAlerts(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  const alerts = getAlerts(accountId).slice(0, 8);
  return {
    text: [
      '🚨 Alerts',
      `${account.businessName || account.name}`,
      divider(),
      alerts.length ? alerts.map((alert, index) => `${index + 1}. ${severityDot(alert.severity)} ${alert.text}`).join('\n\n') : '🟢 No major alerts right now.',
      '',
      updatedAt(account.lastUpdated, 'computed'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Refresh', `alerts:${account.id}`), bt('Account', `screen:account:${account.id}`)],
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderMetaAdSets(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  const items = getMetaAdsets(accountId, campaignId).slice(0, 8);
  return {
    text: [
      '🧩 Meta ad sets',
      `${campaign.name}`,
      divider(),
      items.length
        ? items.map((item, index) => [
            `${index + 1}. ${statusDot(item.status)} ${shorten(item.name, 34)}`,
            `   ${healthDot(item)}  |  Spend ${money(item.spend, account.currency)}  |  Conv ${fmtInt(item.conversions)}  |  CPA ${money(item.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No ad sets found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Ads', `mads:${account.id}:${campaign.id}`), bt('Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Home', 'screen:picker')],
    ]),
  };
}

async function renderMetaAds(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  const items = getMetaAds(accountId, campaignId).slice(0, 8);
  return {
    text: [
      '📣 Meta ads',
      `${campaign.name}`,
      divider(),
      items.length
        ? items.map((item, index) => [
            `${index + 1}. ${statusDot(item.status)} ${shorten(item.name, 34)}`,
            `   ${healthDot(item)}  |  Spend ${money(item.spend, account.currency)}  |  Conv ${fmtInt(item.conversions)}  |  CPA ${money(item.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No ads found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('Ad sets', `madsets:${account.id}:${campaign.id}`), bt('Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('Campaigns', `screen:campaigns:${account.id}`), bt('Home', 'screen:picker')],
    ]),
  };
}

export async function renderScreen(chatId) {
  const state = getSession(chatId);
  if (state.screen === 'account' && state.accountId) return renderAccountSummary(state.accountId);
  if (state.screen === 'campaigns' && state.accountId) return renderCampaignList(state.accountId);
  if (state.screen === 'campaign' && state.accountId && state.campaignId) return renderCampaignDetail(state.accountId, state.campaignId);
  if (state.screen === 'terms' && state.accountId && state.campaignId) return renderSearchTerms(state.accountId, state.campaignId);
  if (state.screen === 'convs' && state.accountId) return renderConversions(state.accountId);
  if (state.screen === 'alerts' && state.accountId) return renderAlerts(state.accountId);
  if (state.screen === 'madsets' && state.accountId && state.campaignId) return renderMetaAdSets(state.accountId, state.campaignId);
  if (state.screen === 'mads' && state.accountId && state.campaignId) return renderMetaAds(state.accountId, state.campaignId);
  return renderPicker(chatId);
}

export async function openAds(chatId, filter = 'all') {
  const state = getSession(chatId);
  state.screen = 'picker';
  state.accountId = null;
  state.campaignId = null;
  state.filter = filter;
  return renderScreen(chatId);
}

export function getActionType(data) {
  if (!data || data === 'screen:picker' || data.startsWith('filter:')) return 'picker';
  if (data.startsWith('pick:') || data.startsWith('screen:account:')) return 'account';
  if (data.startsWith('screen:campaigns:')) return 'campaigns';
  if (data.startsWith('camp:')) return 'campaign';
  if (data.startsWith('terms:')) return 'terms';
  if (data.startsWith('convs:')) return 'convs';
  if (data.startsWith('alerts:')) return 'alerts';
  if (data.startsWith('madsets:')) return 'madsets';
  if (data.startsWith('mads:')) return 'mads';
  return 'account';
}

export async function handleCallback(chatId, data) {
  const state = getSession(chatId);

  if (data === 'screen:picker') {
    state.screen = 'picker';
    state.accountId = null;
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('filter:')) {
    state.filter = data.slice(7);
    state.screen = 'picker';
    state.accountId = null;
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('pick:')) {
    state.screen = 'account';
    state.accountId = normalizeAccountId(data.slice(5));
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('screen:account:')) {
    state.screen = 'account';
    state.accountId = normalizeAccountId(data.slice(15));
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('screen:campaigns:')) {
    state.screen = 'campaigns';
    state.accountId = normalizeAccountId(data.slice(17));
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('convs:')) {
    state.screen = 'convs';
    state.accountId = normalizeAccountId(data.slice(6));
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('alerts:')) {
    state.screen = 'alerts';
    state.accountId = normalizeAccountId(data.slice(7));
    state.campaignId = null;
    return renderScreen(chatId);
  }

  if (data.startsWith('camp:') || data.startsWith('terms:') || data.startsWith('madsets:') || data.startsWith('mads:')) {
    const prefix = data.startsWith('camp:') ? 'camp:' : data.startsWith('terms:') ? 'terms:' : data.startsWith('madsets:') ? 'madsets:' : 'mads:';
    const rest = data.slice(prefix.length);
    const splitIndex = rest.lastIndexOf(':');
    state.accountId = normalizeAccountId(rest.slice(0, splitIndex));
    state.campaignId = rest.slice(splitIndex + 1);
    state.screen = prefix === 'camp:' ? 'campaign' : prefix.replace(':', '');
    return renderScreen(chatId);
  }

  return renderScreen(chatId);
}

export function resetSessions() {
  sessionStore.clear();
}
