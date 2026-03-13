import { getAccount, getAccounts, getCampaign } from './data.js';

const sessionStore = new Map();

function formatMoney(amount, currency) {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${Number(amount).toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatUpdated(iso) {
  if (!iso) return 'Live Google Ads API';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Live Google Ads API';
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function button(text, data) {
  return { text, callback_data: data };
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
  const items = getAccounts();
  return {
    text: [
      'Ads Navigator',
      '',
      'Pick an account to inspect.',
      'This MVP is read only.',
    ].join('\n'),
    reply_markup: keyboard(items.map((account, index) => [button(`${index + 1}. ${account.name}`, `pick:${account.id}`)])),
  };
}

function buildAccountScreen(accountId) {
  const account = getAccount(accountId);
  if (!account) return buildPickerScreen();
  return {
    text: [
      `${account.name} | ${account.platform}`,
      'Last 30 days',
      '',
      `Spend: ${formatMoney(account.summary.spend, account.currency)}`,
      `Clicks: ${account.summary.clicks}`,
      `Conversions: ${account.summary.conversions}`,
      `CPA: ${formatMoney(account.summary.cpa, account.currency)}`,
      `CTR: ${account.summary.ctr}%`,
      '',
      `Active campaigns: ${account.summary.activeCampaigns}`,
      `Paused campaigns: ${account.summary.pausedCampaigns}`,
      '',
      `Updated: ${formatUpdated(account.lastUpdated)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('Campaigns', `screen:campaigns:${account.id}`)],
      [button('Back to accounts', 'screen:picker')],
    ]),
  };
}

function buildCampaignListScreen(accountId) {
  const account = getAccount(accountId);
  if (!account) return buildPickerScreen();
  const activeCampaigns = account.campaigns.slice(0, 5);
  return {
    text: [
      `${account.name} | Campaigns`,
      'Last 30 days',
      '',
      ...activeCampaigns.map((campaign, index) => `${index + 1}. ${campaign.name}\nSpend ${formatMoney(campaign.spend, account.currency)} | Conv ${campaign.conversions} | CPA ${formatMoney(campaign.cpa, account.currency)}`),
      '',
      `Updated: ${formatUpdated(account.lastUpdated)}`,
    ].join('\n'),
    reply_markup: keyboard([
      activeCampaigns.map((campaign, index) => button(String(index + 1), `camp:${account.id}:${campaign.id}`)),
      [button('Back', `screen:account:${account.id}`)],
    ]),
  };
}

function buildCampaignDetailScreen(accountId, campaignId) {
  const account = getAccount(accountId);
  const campaign = getCampaign(accountId, campaignId);
  if (!account || !campaign) return buildCampaignListScreen(accountId);
  return {
    text: [
      `Campaign | ${campaign.name}`,
      `${account.platform} | Last 30 days`,
      '',
      `Status: ${campaign.status}`,
      `Spend: ${formatMoney(campaign.spend, account.currency)}`,
      `Clicks: ${campaign.clicks}`,
      `Conversions: ${campaign.conversions}`,
      `CPA: ${formatMoney(campaign.cpa, account.currency)}`,
      `CTR: ${campaign.ctr}%`,
      `Avg CPC: ${formatMoney(campaign.avgCpc, account.currency)}`,
      '',
      `Type: ${campaign.type}`,
      `Bidding: ${campaign.bidding}`,
      `Daily budget: ${formatMoney(campaign.budgetDaily, account.currency)}`,
      '',
      `Updated: ${formatUpdated(account.lastUpdated)}`,
    ].join('\n'),
    reply_markup: keyboard([
      [button('Back to campaigns', `screen:campaigns:${account.id}`)],
      [button('Back to account', `screen:account:${account.id}`)],
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
    const accountId = callbackData.split(':')[1];
    session.screen = 'account';
    session.accountId = accountId;
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('screen:account:')) {
    session.screen = 'account';
    session.accountId = callbackData.split(':')[2];
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('screen:campaigns:')) {
    session.screen = 'campaigns';
    session.accountId = callbackData.split(':')[2];
    session.campaignId = null;
    return renderScreen(chatId);
  }

  if (callbackData.startsWith('camp:')) {
    const [, accountId, campaignId] = callbackData.split(':');
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
