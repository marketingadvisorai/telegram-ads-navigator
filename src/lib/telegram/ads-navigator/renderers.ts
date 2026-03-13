import { formatDistanceToNowStrict } from 'date-fns';
import type { NavigatorAlert, NavigatorFreshness } from './types';

function money(amount: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function pct(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

export function footer(freshness: NavigatorFreshness, page?: number, totalPages?: number): string {
  const updated = formatDistanceToNowStrict(new Date(freshness.fetchedAt), { addSuffix: true });
  const pageText = page && totalPages ? ` | Page ${page}/${totalPages}` : '';
  return `Updated: ${updated} | Source: ${freshness.source}${pageText}`;
}

export function renderAccountPicker(items: Array<{ label: string }>): string {
  return [
    '<b>Ads Navigator</b>',
    'Pick an account to open.',
    '',
    ...items.map((item, index) => `${index + 1}. ${item.label}`),
  ].join('\n');
}

export function renderAccountSummary(view: any): string {
  const alerts = (view.alerts || []).slice(0, 3).map((alert: NavigatorAlert) => `${severityIcon(alert.severity)} ${alert.message}`);
  return [
    `<b>${view.account.accountName} | Google Ads</b>`,
    rangeLabel(view.dateRange),
    '',
    `Spend: ${money(view.summary.spend, view.account.currency)}`,
    `Clicks: ${num(view.summary.clicks)}`,
    `Conversions: ${num(view.summary.conversions)}`,
    `CPA: ${money(view.summary.cpa, view.account.currency)}`,
    `CTR: ${pct(view.summary.ctr * 100)}`,
    '',
    `Top Campaign: ${view.highlights.topCampaignName || 'N/A'}`,
    `Worst CPA: ${view.highlights.worstCpaCampaignName || 'N/A'}${view.highlights.worstCpa ? ` | ${money(view.highlights.worstCpa, view.account.currency)}` : ''}`,
    `Active: ${view.campaignCounts.active} | Paused: ${view.campaignCounts.paused}`,
    '',
    'Alerts',
    ...(alerts.length ? alerts : ['• No open alerts']),
    '',
    footer(view.freshness),
  ].join('\n');
}

export function renderCampaignList(view: any): string {
  return [
    `<b>${view.accountName} | Campaigns</b>`,
    `${rangeLabel(view.dateRange)} | ${view.filterLabel} | Sort: ${view.sortLabel}`,
    '',
    ...view.items.map((item: any, index: number) => [
      `${index + 1}. ${item.name}`,
      `Spend ${money(item.spend, view.currency)} | Conv ${num(item.conversions)} | CPA ${item.cpa === null ? 'N/A' : money(item.cpa, view.currency)}`,
      '',
    ].join('\n')),
    footer(view.freshness, view.page, view.totalPages),
  ].join('\n');
}

export function renderCampaignDetail(view: any): string {
  const reasons = (view.health.reasons || []).slice(0, 3).map((reason: string) => `• ${reason}`);
  return [
    `<b>Campaign | ${view.campaign.name}</b>`,
    `Google Ads | ${rangeLabel(view.dateRange)}`,
    '',
    `Status: ${view.campaign.status}`,
    `Spend: ${money(view.metrics.spend, view.campaign.currency)}`,
    `Clicks: ${num(view.metrics.clicks)}`,
    `Conversions: ${num(view.metrics.conversions)}`,
    `CPA: ${view.metrics.cpa === null ? 'N/A' : money(view.metrics.cpa, view.campaign.currency)}`,
    `CTR: ${pct(view.metrics.ctr * 100)}`,
    `Avg CPC: ${money(view.metrics.avgCpc, view.campaign.currency)}`,
    '',
    'Health',
    ...(reasons.length ? reasons : ['• No major issues detected']),
    '',
    `Type: ${view.campaign.channelType}`,
    `Bidding: ${view.campaign.biddingStrategy || 'Unknown'}`,
    `Budget: ${money(view.campaign.dailyBudget, view.campaign.currency)}/day`,
    '',
    footer(view.freshness),
  ].join('\n');
}

export function renderSearchTerms(view: any): string {
  return [
    `<b>Search Terms | ${view.campaignName}</b>`,
    `${rangeLabel(view.dateRange)} | Sort: Spend`,
    '',
    ...view.items.map((item: any, index: number) => [
      `${index + 1}. ${item.searchTerm}`,
      `Spend ${money(item.spend, view.currency)} | Clicks ${num(item.clicks)} | Conv ${num(item.conversions)}`,
      '',
    ].join('\n')),
    'Watchouts',
    `${view.zeroConversionSpend > 0 ? '🔴' : '•'} Zero-conversion spend: ${money(view.zeroConversionSpend, view.currency)}`,
    '',
    footer(view.freshness, view.page, view.totalPages),
  ].join('\n');
}

export function renderConversions(view: any): string {
  return [
    `<b>Conversion Actions | ${view.accountName}</b>`,
    rangeLabel(view.dateRange),
    '',
    ...view.items.map((item: any, index: number) => [
      `${index + 1}. ${item.name}`,
      `${item.primary ? 'Primary' : 'Secondary'} | ${item.status} | Conv ${num(item.conversions)}`,
      '',
    ].join('\n')),
    'Audit Signals',
    `🟡 ${view.audit.primaryCount} of ${view.audit.enabledCount} actions are primary`,
    view.audit.primaryCount > view.audit.recommendedPrimaryMax ? '🟡 Review low-value actions marked primary' : '• Primary action count looks reasonable',
    '',
    footer(view.freshness, view.page, view.totalPages),
  ].join('\n');
}

export function renderAlerts(view: any): string {
  return [
    `<b>Alerts | ${view.accountName}</b>`,
    `Open issues: ${view.items.length}`,
    '',
    ...view.items.map((item: NavigatorAlert) => `${severityIcon(item.severity)} ${item.entityName}\n${item.message}\n`),
    footer(view.freshness),
  ].join('\n');
}

export function renderMetaOverview(view: any): string {
  return [
    `<b>${view.account.accountName} | Meta Ads</b>`,
    rangeLabel(view.dateRange),
    '',
    `Spend: ${money(view.summary.spend, view.account.currency)}`,
    `Purchases: ${num(view.summary.purchases)}`,
    `CPA: ${view.summary.cpa === null ? 'N/A' : money(view.summary.cpa, view.account.currency)}`,
    `Active campaigns: ${view.summary.activeCampaigns}`,
    `Paused campaigns: ${view.summary.pausedCampaigns}`,
    `Ended winner: ${view.highlights.winnerCampaignName || 'N/A'}`,
    `Winner CPA: ${view.highlights.winnerCpa === null ? 'N/A' : money(view.highlights.winnerCpa, view.account.currency)}`,
    '',
    'Highlights',
    ...(view.highlights.lines || ['• No Meta highlights available']),
    '',
    footer(view.freshness),
  ].join('\n');
}

function rangeLabel(value: string): string {
  return value === 'LAST_7_DAYS' ? 'Last 7 days' : value === 'LAST_90_DAYS' ? 'Last 90 days' : 'Last 30 days';
}

function num(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value || 0);
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    default:
      return '•';
  }
}
