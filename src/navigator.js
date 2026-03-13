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
const PICKER_PAGE_SIZE = 6;
const CAMPAIGN_PAGE_SIZE = 5;

function getSession(chatId) {
  let state = sessionStore.get(chatId);
  if (!state) {
    state = {
      screen: 'picker',
      accountId: null,
      campaignId: null,
      filter: 'all',
      pickerPage: 0,
      campaignPageByAccount: {},
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
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? numeric.toLocaleString('en-GB') : numeric.toLocaleString('en-GB', { maximumFractionDigits: 2 });
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
  if (!iso) return `Updated: live • Source: ${source}`;
  return `Updated: ${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC • Source: ${source}`;
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

function platformIcon(platform = '') {
  return platform === 'Google Ads' ? '🔎' : '📘';
}

function platformBadge(platform = '') {
  return platform === 'Google Ads' ? 'G' : 'M';
}

function normalizeBusinessKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/google ads|meta ads|ad account|account|act_/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBusinessLabel(...values) {
  for (const candidate of values) {
    const text = String(candidate || '').trim();
    if (!text) continue;
    if (/^act_?\d+$/i.test(text)) continue;
    if (/^\d{6,}$/.test(text)) return `Ad Account ${text.slice(-4)}`;
    return text;
  }
  const fallback = String(values.find(Boolean) || 'Unknown business');
  return /^\d{6,}$/.test(fallback) ? `Ad Account ${fallback.slice(-4)}` : fallback;
}

function findSiblingAccount(account, allAccounts) {
  if (!account) return null;
  const targetPlatform = account.platform === 'Google Ads' ? 'Meta Ads' : 'Google Ads';
  const targetKey = normalizeBusinessKey(account.businessName || account.name);
  const targetName = normalizeBusinessKey(account.name || '');

  return allAccounts.find((candidate) => {
    if (candidate.platform !== targetPlatform) return false;
    const candidateKey = normalizeBusinessKey(candidate.businessName || candidate.name);
    const candidateName = normalizeBusinessKey(candidate.name || '');
    return candidateKey === targetKey || candidateName === targetKey || candidateName === targetName;
  }) || null;
}

function buildBusinessGroups(accounts, filter = 'all') {
  const groups = new Map();

  for (const account of accounts) {
    const groupKey = normalizeBusinessKey(account.businessName || account.name || account.id) || account.id;
    const existing = groups.get(groupKey) || {
      key: groupKey,
      label: cleanBusinessLabel(account.businessName, account.name, account.id),
      accounts: [],
    };
    existing.accounts.push(account);
    if ((account.businessName || '').length < existing.label.length) {
      existing.label = cleanBusinessLabel(account.businessName, account.name, account.id);
    }
    groups.set(groupKey, existing);
  }

  return [...groups.values()]
    .map((group) => {
      const google = group.accounts.find((item) => item.platform === 'Google Ads') || null;
      const meta = group.accounts.find((item) => item.platform === 'Meta Ads') || null;
      const preferred = filter === 'google' ? (google || meta) : filter === 'meta' ? (meta || google) : (google || meta || group.accounts[0]);
      const badges = [google ? 'G' : null, meta ? 'M' : null].filter(Boolean).join(' • ');
      return {
        ...group,
        google,
        meta,
        preferred,
        badges,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function pageSlice(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * pageSize;
  return {
    safePage,
    totalPages,
    start,
    end: Math.min(start + pageSize, items.length),
    items: items.slice(start, start + pageSize),
  };
}

function pagerRow(prefix, page, totalPages) {
  return [
    bt(page > 0 ? '◀ Prev' : '·', page > 0 ? `${prefix}:${page - 1}` : 'noop'),
    bt(`Page ${page + 1}/${totalPages}`, 'noop'),
    bt(page < totalPages - 1 ? 'Next ▶' : '·', page < totalPages - 1 ? `${prefix}:${page + 1}` : 'noop'),
  ];
}

function campaignPageFor(state, accountId, campaigns) {
  const stored = Number(state.campaignPageByAccount[accountId] || 0);
  if (!state.campaignId) return stored;
  const index = campaigns.findIndex((campaign) => String(campaign.id) === String(state.campaignId));
  return index >= 0 ? Math.floor(index / CAMPAIGN_PAGE_SIZE) : stored;
}

function accountShortId(account) {
  const raw = String(account?.id || '').split(':').pop() || '';
  return raw ? `#${raw.slice(-4)}` : '';
}

function campaignButtonLabel(campaign, indexOnPage) {
  const status = statusDot(campaign.status);
  const health = healthDot(campaign).split(' ')[0];
  return `${indexOnPage + 1}. ${status}${health} ${shorten(campaign.name, 24)}`;
}

async function renderPicker(chatId) {
  const state = getSession(chatId);
  const allAccounts = getAccounts('all');
  const visibleAccounts = getAccounts(state.filter);
  const businesses = buildBusinessGroups(visibleAccounts, state.filter);
  const googleCount = getAccounts('google').length;
  const metaCount = getAccounts('meta').length;
  const page = pageSlice(businesses, state.pickerPage, PICKER_PAGE_SIZE);
  state.pickerPage = page.safePage;

  const title = state.filter === 'google'
    ? '🔎 Google Ads Navigator'
    : state.filter === 'meta'
      ? '📘 Meta Ads Navigator'
      : '✨ Ads Navigator';

  const lines = [
    title,
    'Home / Accounts',
    divider(),
    'Choose a business to inspect.',
    `Businesses: ${businesses.length} • Accounts: ${visibleAccounts.length}`,
    `Google: ${googleCount} • Meta: ${metaCount}`,
    page.items.length
      ? `Showing ${page.start + 1}-${page.end} of ${businesses.length} businesses`
      : 'No accounts found for this filter.',
    '',
  ];

  if (page.items.length) {
    lines.push(
      ...page.items.map((group, index) => {
        const accounts = group.accounts
          .sort((a, b) => (a.platform === 'Google Ads' ? -1 : 1) - (b.platform === 'Google Ads' ? -1 : 1))
          .map((account) => `${platformBadge(account.platform)} ${accountShortId(account)}`.trim())
          .join(' • ');
        return `${page.start + index + 1}. ${group.label}  [${group.badges}]\n   ${accounts}`;
      }),
    );
  }

  const rows = [
    [bt(state.filter === 'all' ? '• All accounts' : 'All accounts', 'filter:all')],
    [bt(state.filter === 'google' ? '• Google only' : 'Google only', 'filter:google'), bt(state.filter === 'meta' ? '• Meta only' : 'Meta only', 'filter:meta')],
    ...page.items.flatMap((group) => {
      const mainRow = [bt(`${group.google && group.meta ? '🏢' : platformIcon(group.preferred?.platform)} ${shorten(group.label, 24)}`, `biz:${group.key}`)];
      if (group.google && group.meta && state.filter === 'all') {
        return [
          mainRow,
          [bt('🔎 Google', `pick:${group.google.id}`), bt('📘 Meta', `pick:${group.meta.id}`)],
        ];
      }
      return [mainRow];
    }),
    pagerRow('page:picker', page.safePage, page.totalPages),
  ];

  return { text: lines.join('\n'), reply_markup: kb(rows) };
}

async function renderAccountSummary(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  const sibling = findSiblingAccount(account, getAccounts('all'));
  const isGoogle = account.platform === 'Google Ads';
  const alertsCount = getAlerts(account.id).length;

  return {
    text: [
      `${platformIcon(account.platform)} ${account.businessName || account.name}`,
      `Accounts / ${account.businessName || account.name}`,
      divider(),
      `${account.platform} • ${account.name}${accountShortId(account) ? ` • ${accountShortId(account)}` : ''}`,
      `Spend ${money(account.summary.spend, account.currency)} • Clicks ${fmtInt(account.summary.clicks)} • ${isGoogle ? 'Conv' : 'Purch'} ${fmtInt(account.summary.conversions)}`,
      `CPA ${money(account.summary.cpa, account.currency)} • CTR ${fmtPct(account.summary.ctr)}`,
      '',
      'Quick view',
      `${statusDot('active')} Active ${fmtInt(account.summary.activeCampaigns)} • ${statusDot('paused')} Paused ${fmtInt(account.summary.pausedCampaigns)}`,
      `🚨 Alerts ${fmtInt(alertsCount)} • Pair ${sibling ? `${platformBadge(account.platform)} ⇄ ${platformBadge(sibling.platform)}` : 'single platform'}`,
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('📋 Campaigns', `screen:campaigns:${account.id}`), bt('🚨 Alerts', `alerts:${account.id}`)],
      isGoogle
        ? [bt('⚙️ Conversions', `convs:${account.id}`), bt(sibling ? '📘 Open Meta' : '🔄 Refresh summary', sibling ? `screen:account:${sibling.id}` : `screen:account:${account.id}`)]
        : [bt(sibling ? '🔎 Open Google' : '🔄 Refresh summary', sibling ? `screen:account:${sibling.id}` : `screen:account:${account.id}`), bt('🔄 Refresh summary', `screen:account:${account.id}`)],
      [bt('⬅ Back to Accounts', 'screen:picker')],
    ]),
  };
}

async function renderCampaignList(chatId, accountId) {
  const state = getSession(chatId);
  const account = getAccount(accountId);
  if (!account) return renderPicker(chatId);

  const campaigns = account.campaigns || [];
  const page = pageSlice(campaigns, campaignPageFor(state, account.id, campaigns), CAMPAIGN_PAGE_SIZE);
  state.campaignPageByAccount[account.id] = page.safePage;

  return {
    text: [
      `📋 Campaigns`,
      `${account.businessName || account.name} / Campaigns`,
      divider(),
      `Showing ${campaigns.length ? page.start + 1 : 0}-${page.end} of ${campaigns.length} • Sorted by spend`,
      `Platform: ${account.platform}`,
      '',
      page.items.length
        ? page.items.map((campaign, index) => [
            `${page.start + index + 1}. ${statusDot(campaign.status)} ${shorten(campaign.name, 34)}`,
            `   ${campaign.type} • ${healthDot(campaign)}`,
            `   Spend ${money(campaign.spend, account.currency)} • Conv ${fmtInt(campaign.conversions)} • CPA ${money(campaign.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No campaign rows found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      ...page.items.map((campaign, index) => [bt(campaignButtonLabel(campaign, index), `camp:${account.id}:${campaign.id}`)]),
      pagerRow(`page:campaigns:${account.id}`, page.safePage, page.totalPages),
      [bt('⬅ Back to Account', `screen:account:${account.id}`), bt('🔄 Refresh list', `screen:campaigns:${account.id}`)],
      [bt('🏠 Home', 'screen:picker')],
    ]),
  };
}

async function renderCampaignDetail(chatId, accountId, campaignId) {
  const state = getSession(chatId);
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  const campaigns = account.campaigns || [];
  const campaignIndex = campaigns.findIndex((item) => String(item.id) === String(campaign.id));
  if (campaignIndex >= 0) {
    state.campaignPageByAccount[account.id] = Math.floor(campaignIndex / CAMPAIGN_PAGE_SIZE);
  }
  const prev = campaignIndex > 0 ? campaigns[campaignIndex - 1] : null;
  const next = campaignIndex >= 0 && campaignIndex < campaigns.length - 1 ? campaigns[campaignIndex + 1] : null;
  const isMeta = account.platform === 'Meta Ads';

  return {
    text: [
      '🎯 Campaign Detail',
      `${account.businessName || account.name} / ${campaign.name}`,
      divider(),
      `${statusDot(campaign.status)} Status: ${campaign.status}`,
      `Type: ${campaign.type}`,
      `Strategy: ${campaign.bidding}`,
      `Daily budget: ${money(campaign.budgetDaily, account.currency)}`,
      '',
      `Spend: ${money(campaign.spend, account.currency)} • Clicks: ${fmtInt(campaign.clicks)}`,
      `${isMeta ? 'Purch' : 'Conv'}: ${fmtInt(campaign.conversions)} • CPA: ${money(campaign.cpa, account.currency)}`,
      `CTR: ${fmtPct(campaign.ctr)} • Avg CPC: ${money(campaign.avgCpc, account.currency)}`,
      '',
      `Assessment: ${healthDot(campaign)}`,
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      isMeta
        ? [bt('🧩 Ad sets', `madsets:${account.id}:${campaign.id}`), bt('📣 Ads', `mads:${account.id}:${campaign.id}`)]
        : [bt('🔎 Search Terms', `terms:${account.id}:${campaign.id}`), bt('⚙️ Conversions', `convs:${account.id}`)],
      [bt(prev ? '◀ Prev Campaign' : '·', prev ? `camp:${account.id}:${prev.id}` : 'noop'), bt(next ? 'Next Campaign ▶' : '·', next ? `camp:${account.id}:${next.id}` : 'noop')],
      [bt('⬅ Back to Campaigns', `screen:campaigns:${account.id}`), bt('🔄 Refresh card', `camp:${account.id}:${campaign.id}`)],
      [bt('🏠 Home', 'screen:picker')],
    ]),
  };
}

async function renderSearchTerms(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return renderAccountSummary(accountId);

  if (account.platform !== 'Google Ads') {
    return {
      text: ['🔎 Search Terms', `${account.businessName || account.name} / ${campaign.name}`, divider(), 'Search terms are available only for Google Ads.', '', updatedAt(account.lastUpdated, 'live')].join('\n'),
      reply_markup: kb([[bt('⬅ Back to Campaign', `camp:${account.id}:${campaign.id}`), bt('🏠 Home', 'screen:picker')]]),
    };
  }

  const terms = getSearchTerms(accountId, campaignId).slice(0, 8);
  const wasteCount = terms.filter((term) => Number(term.spend || 0) > 0 && Number(term.conversions || 0) === 0).length;

  return {
    text: [
      '🔎 Search Terms',
      `${account.businessName || account.name} / ${campaign.name}`,
      divider(),
      terms.length
        ? terms.map((term, index) => [
            `${index + 1}. ${shorten(term.term, 36)}`,
            `   ${Number(term.conversions || 0) > 0 ? '🟢 converting' : '🔴 no conv'} • Spend ${money(term.spend, account.currency)} • Clicks ${fmtInt(term.clicks)} • Conv ${fmtInt(term.conversions)}`,
          ].join('\n')).join('\n\n')
        : 'No search term rows found for this range.',
      '',
      wasteCount ? `Watchouts: 🔴 ${wasteCount} visible terms have zero conversions` : 'Watchouts: 🟢 No major waste in the visible rows',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('🔄 Refresh terms', `terms:${account.id}:${campaign.id}`), bt('⬅ Back to Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('📋 Campaigns', `screen:campaigns:${account.id}`), bt('🏠 Home', 'screen:picker')],
    ]),
  };
}

async function renderConversions(accountId) {
  const account = getAccount(accountId);
  if (!account) return renderPicker(0);

  if (account.platform !== 'Google Ads') {
    return {
      text: ['⚙️ Conversion Actions', `${account.businessName || account.name}`, divider(), 'Detailed conversion actions are available only for Google Ads right now.'].join('\n'),
      reply_markup: kb([[bt('⬅ Back to Account', `screen:account:${account.id}`), bt('🏠 Home', 'screen:picker')]]),
    };
  }

  const actions = getConversionActions(accountId).slice(0, 10);
  const primaryCount = actions.filter((action) => action.primary).length;

  return {
    text: [
      '⚙️ Conversion Actions',
      `${account.businessName || account.name} / Settings`,
      divider(),
      actions.length
        ? actions.map((action, index) => `${index + 1}. ${shorten(action.name, 32)}\n   ${action.primary ? '🟢 primary' : '⚪ secondary'} • ${shorten(action.type, 12)} • ${shorten(action.category, 14)}`).join('\n\n')
        : 'No conversion actions found.',
      '',
      `Audit: ${primaryCount > 5 ? '🟡' : '🟢'} ${primaryCount} visible actions are primary`,
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('🔄 Refresh actions', `convs:${account.id}`), bt('⬅ Back to Account', `screen:account:${account.id}`)],
      [bt('🏠 Home', 'screen:picker')],
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
      `${account.businessName || account.name} / Alerts`,
      divider(),
      alerts.length ? alerts.map((alert, index) => `${index + 1}. ${severityDot(alert.severity)} ${alert.text}`).join('\n\n') : '🟢 No major alerts right now.',
      '',
      updatedAt(account.lastUpdated, 'computed'),
    ].join('\n'),
    reply_markup: kb([
      [bt('🔄 Refresh alerts', `alerts:${account.id}`), bt('⬅ Back to Account', `screen:account:${account.id}`)],
      [bt('📋 Campaigns', `screen:campaigns:${account.id}`), bt('🏠 Home', 'screen:picker')],
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
      '🧩 Meta Ad Sets',
      `${account.businessName || account.name} / ${campaign.name}`,
      divider(),
      items.length
        ? items.map((item, index) => [
            `${index + 1}. ${statusDot(item.status)} ${shorten(item.name, 34)}`,
            `   ${healthDot(item)} • Spend ${money(item.spend, account.currency)} • Conv ${fmtInt(item.conversions)} • CPA ${money(item.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No ad sets found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('📣 Ads', `mads:${account.id}:${campaign.id}`), bt('⬅ Back to Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('📋 Campaigns', `screen:campaigns:${account.id}`), bt('🏠 Home', 'screen:picker')],
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
      '📣 Meta Ads',
      `${account.businessName || account.name} / ${campaign.name}`,
      divider(),
      items.length
        ? items.map((item, index) => [
            `${index + 1}. ${statusDot(item.status)} ${shorten(item.name, 34)}`,
            `   ${healthDot(item)} • Spend ${money(item.spend, account.currency)} • Conv ${fmtInt(item.conversions)} • CPA ${money(item.cpa, account.currency)}`,
          ].join('\n')).join('\n\n')
        : 'No ads found.',
      '',
      updatedAt(account.lastUpdated, 'live'),
    ].join('\n'),
    reply_markup: kb([
      [bt('🧩 Ad sets', `madsets:${account.id}:${campaign.id}`), bt('⬅ Back to Campaign', `camp:${account.id}:${campaign.id}`)],
      [bt('📋 Campaigns', `screen:campaigns:${account.id}`), bt('🏠 Home', 'screen:picker')],
    ]),
  };
}

export async function renderScreen(chatId) {
  const state = getSession(chatId);
  if (state.screen === 'account' && state.accountId) return renderAccountSummary(state.accountId);
  if (state.screen === 'campaigns' && state.accountId) return renderCampaignList(chatId, state.accountId);
  if (state.screen === 'campaign' && state.accountId && state.campaignId) return renderCampaignDetail(chatId, state.accountId, state.campaignId);
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
  state.pickerPage = 0;
  return renderScreen(chatId);
}

export function getActionType(data) {
  if (!data || data === 'screen:picker' || data.startsWith('filter:') || data.startsWith('page:picker') || data === 'noop') return 'picker';
  if (data.startsWith('pick:') || data.startsWith('screen:account:') || data.startsWith('biz:')) return 'account';
  if (data.startsWith('screen:campaigns:') || data.startsWith('page:campaigns:')) return 'campaigns';
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

  if (data === 'noop') {
    return renderScreen(chatId);
  }

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
    state.pickerPage = 0;
    return renderScreen(chatId);
  }

  if (data.startsWith('page:picker:')) {
    state.screen = 'picker';
    state.accountId = null;
    state.campaignId = null;
    state.pickerPage = Number(data.slice(12)) || 0;
    return renderScreen(chatId);
  }

  if (data.startsWith('biz:')) {
    const key = data.slice(4);
    const groups = buildBusinessGroups(getAccounts(state.filter), state.filter);
    const group = groups.find((item) => item.key === key);
    state.screen = 'account';
    state.accountId = normalizeAccountId(group?.preferred?.id || groups[0]?.preferred?.id || null);
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

  if (data.startsWith('page:campaigns:')) {
    const rest = data.slice(15);
    const splitIndex = rest.lastIndexOf(':');
    const accountId = normalizeAccountId(rest.slice(0, splitIndex));
    const page = Number(rest.slice(splitIndex + 1)) || 0;
    state.screen = 'campaigns';
    state.accountId = accountId;
    state.campaignId = null;
    state.campaignPageByAccount[accountId] = page;
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
