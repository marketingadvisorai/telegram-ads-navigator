import { getAccount, getAccounts, getCampaign, getSearchTerms, getConversionActions, getAlerts } from './data.js';

const sessionStore = new Map();

function formatMoney(amount, currency) { const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : `${currency} `; return `${symbol}${Number(amount).toFixed(amount % 1 === 0 ? 0 : 2)}`; }
function formatUpdated(iso, platform = 'API') { if (!iso) return `Live ${platform}`; const date = new Date(iso); if (Number.isNaN(date.getTime())) return `Live ${platform}`; return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`; }
const keyboard = (rows) => ({ inline_keyboard: rows });
const button = (text, data) => ({ text, callback_data: data });
const platformIcon = (platform) => platform === 'Google Ads' ? '🔎' : platform === 'Meta Ads' ? '📘' : '📊';
function metricTone(value, { goodHigh = true } = {}) { if (value === null || value === undefined) return '•'; if (goodHigh) { if (value >= 15) return '🟢'; if (value >= 5) return '🟡'; return '🔴'; } if (value <= 25) return '🟢'; if (value <= 75) return '🟡'; return '🔴'; }
function campaignLabel(campaign) { if ((campaign.conversions || 0) >= 10 && (campaign.cpa || 0) > 0 && campaign.cpa <= 25) return '🟢 strong'; if ((campaign.conversions || 0) >= 3) return '🟡 mixed'; return '🔴 watch'; }
const pad = (value, width) => { const text = String(value ?? ''); return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length); };
const clip = (text, max) => text.length <= max ? text : `${text.slice(0, max - 1)}…`;

function getSession(chatId) { let session = sessionStore.get(chatId); if (!session) { session = { screen: 'picker', accountId: null, campaignId: null, campaignsView: 'cards', filter: 'all' }; sessionStore.set(chatId, session); } return session; }

function buildPickerScreen(chatId) {
  const session = getSession(chatId); const items = getAccounts(session.filter).slice(0, 20);
  const googleCount = getAccounts('google').length; const metaCount = getAccounts('meta').length;
  const title = session.filter === 'google' ? '🔎 Google Ads Navigator' : session.filter === 'meta' ? '📘 Meta Ads Navigator' : '✨ Ads Navigator';
  return { text: [title, '', 'Choose an account to inspect.', 'Read only mode is on.', '', `Google: ${googleCount} | Meta: ${metaCount}`, `Showing: ${items.length} accounts`].join('\n'), reply_markup: keyboard([[button('All', 'filter:all'), button('Google', 'filter:google'), button('Meta', 'filter:meta')], ...items.map((account, index) => [button(`${index + 1}. ${platformIcon(account.platform)} ${clip(account.businessName || account.name, 18)} | ${clip(account.name, 18)}`, `pick:${account.id}`)])]) };
}

function buildAccountScreen(accountId) {
  const account = getAccount(accountId); if (!account) return buildPickerScreen(0);
  const convTone = metricTone(account.summary.conversions, { goodHigh: true }); const cpaTone = metricTone(account.summary.cpa, { goodHigh: false });
  return { text: [`${platformIcon(account.platform)} ${account.businessName || account.name}`, `${account.name}`, `${account.platform} | ID: ${account.id}`, '', `💰 Spend: ${formatMoney(account.summary.spend, account.currency)}`, `👆 Clicks: ${account.summary.clicks}`, `${convTone} Conversions: ${account.summary.conversions}`, `${cpaTone} CPA: ${formatMoney(account.summary.cpa, account.currency)}`, `📈 CTR: ${account.summary.ctr}%`, '', `🟢 Active campaigns: ${account.summary.activeCampaigns}`, `⏸️ Paused campaigns: ${account.summary.pausedCampaigns}`, '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`].join('\n'), reply_markup: keyboard([[button('📋 Campaigns', `screen:campaigns:${account.id}`), button('🎯 Alerts', `alerts:${account.id}`)], [button('⚙️ Conversions', `convs:${account.id}`), button('🔄 Refresh', `screen:account:${account.id}`)], [button('🏠 Home', 'screen:picker')]]) };
}

function buildCampaignCards(account, campaigns) { return [`📋 ${account.businessName || account.name}`, `${account.name}`, `${account.platform} campaigns | Last 30 days`, 'View: Cards', '', ...campaigns.map((campaign, index) => `${index + 1}. ${campaign.name}\n${campaignLabel(campaign)} | Spend ${formatMoney(campaign.spend, account.currency)} | Conv ${campaign.conversions} | CPA ${formatMoney(campaign.cpa, account.currency)}`), '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`].join('\n'); }
function buildCampaignTable(account, campaigns) { const lines = [`📊 ${account.businessName || account.name}`, `${account.name}`, `${account.platform} campaigns | Table`, '', '```', `${pad('#', 2)} ${pad('Campaign', 22)} ${pad('Spend', 7)} ${pad('Conv', 5)} ${pad('CPA', 7)} ${pad('Flag', 6)}`]; campaigns.forEach((campaign, index) => { lines.push(`${pad(index + 1, 2)} ${pad(clip(campaign.name, 22), 22)} ${pad(formatMoney(campaign.spend, account.currency), 7)} ${pad(campaign.conversions, 5)} ${pad(formatMoney(campaign.cpa, account.currency), 7)} ${pad(campaignLabel(campaign).split(' ')[0], 6)}`); }); lines.push('```', '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`); return lines.join('\n'); }

function buildCampaignListScreen(chatId, accountId) {
  const session = getSession(chatId); const account = getAccount(accountId); if (!account) return buildPickerScreen(chatId);
  const campaigns = (account.campaigns || []).slice(0, 5); const text = session.campaignsView === 'table' ? buildCampaignTable(account, campaigns) : buildCampaignCards(account, campaigns);
  return { text, parse_mode: session.campaignsView === 'table' ? 'Markdown' : undefined, reply_markup: keyboard([campaigns.map((campaign, index) => button(String(index + 1), `camp:${account.id}:${campaign.id}`)), [button(session.campaignsView === 'table' ? '🧾 Cards' : '📊 Table', `toggle:campaigns:${account.id}`), button('🔄 Refresh', `screen:campaigns:${account.id}`)], [button('◀️ Back', `screen:account:${account.id}`), button('🏠 Home', 'screen:picker')]]) };
}

function buildSearchTermsScreen(accountId, campaignId) {
  const account = getAccount(accountId); const campaign = getCampaign(accountId, campaignId); const terms = getSearchTerms(accountId, campaignId).slice(0, 8);
  if (!account || !campaign) return buildAccountScreen(accountId);
  if (account.platform !== 'Google Ads') return { text: ['🔎 Search Terms', '', 'Search terms are available only for Google Ads right now.', '', `Campaign: ${campaign.name}`].join('\n'), reply_markup: keyboard([[button('◀️ Back to campaign', `camp:${account.id}:${campaign.id}`)], [button('🏠 Home', 'screen:picker')]]) };
  const lines = ['🔎 Search Terms', campaign.name, '', '```', `${pad('#', 2)} ${pad('Term', 26)} ${pad('Spend', 7)} ${pad('Clk', 4)} ${pad('Conv', 5)}`];
  if (terms.length) terms.forEach((term, index) => lines.push(`${pad(index + 1, 2)} ${pad(clip(term.term, 26), 26)} ${pad(formatMoney(term.spend, account.currency), 7)} ${pad(term.clicks, 4)} ${pad(term.conversions, 5)}`)); else lines.push('No search term rows found.');
  lines.push('```', '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`);
  return { text: lines.join('\n'), parse_mode: 'Markdown', reply_markup: keyboard([[button('🔄 Refresh', `terms:${account.id}:${campaign.id}`)], [button('◀️ Campaign', `camp:${account.id}:${campaign.id}`), button('📋 Campaigns', `screen:campaigns:${account.id}`)], [button('🏠 Home', 'screen:picker')]]) };
}

function buildConversionsScreen(accountId) {
  const account = getAccount(accountId); if (!account) return buildPickerScreen(0);
  if (account.platform !== 'Google Ads') return { text: ['⚙️ Conversion Actions', '', 'Detailed conversion actions are available only for Google Ads right now.'].join('\n'), reply_markup: keyboard([[button('◀️ Back', `screen:account:${account.id}`)], [button('🏠 Home', 'screen:picker')]]) };
  const convs = getConversionActions(accountId).slice(0, 12);
  const lines = ['⚙️ Conversion Actions', `${account.businessName || account.name}`, '', '```', `${pad('P', 2)} ${pad('Type', 10)} ${pad('Category', 14)} Name`];
  convs.forEach((c) => lines.push(`${pad(c.primary ? 'Y' : 'N', 2)} ${pad(clip(c.type, 10), 10)} ${pad(clip(c.category, 14), 14)} ${clip(c.name, 28)}`));
  lines.push('```', '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`);
  return { text: lines.join('\n'), parse_mode: 'Markdown', reply_markup: keyboard([[button('🔄 Refresh', `convs:${account.id}`)], [button('◀️ Back', `screen:account:${account.id}`), button('🏠 Home', 'screen:picker')]]) };
}

function buildAlertsScreen(accountId) {
  const account = getAccount(accountId); if (!account) return buildPickerScreen(0);
  const alerts = getAlerts(accountId);
  const icon = (sev) => sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵';
  return { text: ['🎯 Alerts', `${account.businessName || account.name}`, '', ...(alerts.length ? alerts.map((a, i) => `${i + 1}. ${icon(a.severity)} ${a.text}`) : ['No major alerts found right now.']), '', `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`].join('\n'), reply_markup: keyboard([[button('🔄 Refresh', `alerts:${account.id}`)], [button('◀️ Back', `screen:account:${account.id}`), button('🏠 Home', 'screen:picker')]]) };
}

function buildCampaignDetailScreen(accountId, campaignId) {
  const account = getAccount(accountId); const campaign = getCampaign(accountId, campaignId); if (!account || !campaign) return buildAccountScreen(accountId);
  return { text: [`🎯 ${campaign.name}`, `${account.businessName || account.name}`, `${account.platform} | ${account.id}`, '', `Status: ${campaign.status}`, `Type: ${campaign.type}`, `Bidding: ${campaign.bidding}`, '', `💰 Spend: ${formatMoney(campaign.spend, account.currency)}`, `👆 Clicks: ${campaign.clicks}`, `🎯 Conversions: ${campaign.conversions}`, `CPA: ${formatMoney(campaign.cpa, account.currency)}`, `CTR: ${campaign.ctr}%`, `Avg CPC: ${formatMoney(campaign.avgCpc, account.currency)}`, `Daily budget: ${formatMoney(campaign.budgetDaily, account.currency)}`, '', `Assessment: ${campaignLabel(campaign)}`, `Updated: ${formatUpdated(account.lastUpdated, account.platform)}`].join('\n'), reply_markup: keyboard([[button('🔎 Search Terms', `terms:${account.id}:${campaign.id}`), button('🔄 Refresh', `camp:${account.id}:${campaign.id}`)], [button('📋 Campaigns', `screen:campaigns:${account.id}`), button('◀️ Account', `screen:account:${account.id}`)], [button('🏠 Home', 'screen:picker')]]) };
}

export function renderScreen(chatId) {
  const s = getSession(chatId);
  if (s.screen === 'account' && s.accountId) return buildAccountScreen(s.accountId);
  if (s.screen === 'campaigns' && s.accountId) return buildCampaignListScreen(chatId, s.accountId);
  if (s.screen === 'campaign' && s.accountId && s.campaignId) return buildCampaignDetailScreen(s.accountId, s.campaignId);
  if (s.screen === 'terms' && s.accountId && s.campaignId) return buildSearchTermsScreen(s.accountId, s.campaignId);
  if (s.screen === 'convs' && s.accountId) return buildConversionsScreen(s.accountId);
  if (s.screen === 'alerts' && s.accountId) return buildAlertsScreen(s.accountId);
  return buildPickerScreen(chatId);
}

export function openAds(chatId, filter = 'all') { const s = getSession(chatId); s.screen = 'picker'; s.accountId = null; s.campaignId = null; s.campaignsView = 'cards'; s.filter = filter; return renderScreen(chatId); }

export function handleCallback(chatId, callbackData) {
  const s = getSession(chatId);
  if (callbackData === 'screen:picker') { s.screen = 'picker'; s.accountId = null; s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('filter:')) { s.filter = callbackData.slice('filter:'.length); s.screen = 'picker'; s.accountId = null; s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('pick:')) { s.screen = 'account'; s.accountId = callbackData.slice('pick:'.length); s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('screen:account:')) { s.screen = 'account'; s.accountId = callbackData.slice('screen:account:'.length); s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('screen:campaigns:')) { s.screen = 'campaigns'; s.accountId = callbackData.slice('screen:campaigns:'.length); s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('toggle:campaigns:')) { s.screen = 'campaigns'; s.accountId = callbackData.slice('toggle:campaigns:'.length); s.campaignsView = s.campaignsView === 'table' ? 'cards' : 'table'; return renderScreen(chatId); }
  if (callbackData.startsWith('terms:')) { const rest = callbackData.slice('terms:'.length); const lastColon = rest.lastIndexOf(':'); s.screen = 'terms'; s.accountId = rest.slice(0, lastColon); s.campaignId = rest.slice(lastColon + 1); return renderScreen(chatId); }
  if (callbackData.startsWith('convs:')) { s.screen = 'convs'; s.accountId = callbackData.slice('convs:'.length); s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('alerts:')) { s.screen = 'alerts'; s.accountId = callbackData.slice('alerts:'.length); s.campaignId = null; return renderScreen(chatId); }
  if (callbackData.startsWith('camp:')) { const rest = callbackData.slice('camp:'.length); const lastColon = rest.lastIndexOf(':'); s.screen = 'campaign'; s.accountId = rest.slice(0, lastColon); s.campaignId = rest.slice(lastColon + 1); return renderScreen(chatId); }
  return renderScreen(chatId);
}

export function resetSessions() { sessionStore.clear(); }
