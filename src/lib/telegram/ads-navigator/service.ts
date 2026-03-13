import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/workspaces';
import { workspaceIntegrations } from '@/lib/db/schema/workspace-integrations';
import { cacheGetOrFetch } from '@/lib/cache/valkey-client';
import { getClientForWorkspace, gaqlSearch } from '@/lib/integrations/google-ads/client';
import { getAccountPerformance, getSearchTermsReport } from '@/lib/integrations/google-ads/reporting';
import { listCampaigns, getCampaign } from '@/lib/integrations/google-ads/campaigns';
import { ensureFreshToken as ensureFreshMetaToken } from '@/lib/services/meta/token-refresh';
import type { AccountPickerItem, AdsNavigatorDateRange, NavigatorAlert, NavigatorFreshness } from './types';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

function toMetaDatePreset(dateRange: AdsNavigatorDateRange): string {
  if (dateRange === 'LAST_7_DAYS') return 'last_7d';
  if (dateRange === 'LAST_90_DAYS') return 'last_90d';
  return 'last_30d';
}

function ttlFor(screen: string): number {
  if (screen === 'search_terms' || screen === 'meta_overview') return 600;
  if (screen === 'conversions') return 900;
  return 300;
}

function freshness(source: NavigatorFreshness['source']): NavigatorFreshness {
  return { fetchedAt: new Date().toISOString(), cacheAgeSeconds: 0, source };
}

export async function listAdsNavigatorAccounts(): Promise<AccountPickerItem[]> {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      platform: workspaceIntegrations.platform,
      accountId: workspaceIntegrations.accountId,
      accountName: workspaceIntegrations.accountName,
    })
    .from(workspaces)
    .innerJoin(workspaceIntegrations, eq(workspaceIntegrations.workspaceId, workspaces.id))
    .where(inArray(workspaceIntegrations.platform, ['google_ads', 'meta_ads']));

  const byWorkspace = new Map<string, AccountPickerItem>();
  for (const row of rows) {
    const existing = byWorkspace.get(row.workspaceId) || {
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      label: row.workspaceName,
      googleAccountId: null,
      googleAccountName: null,
      metaAccountId: null,
      metaAccountName: null,
    };

    if (row.platform === 'google_ads') {
      existing.googleAccountId = row.accountId;
      existing.googleAccountName = row.accountName;
    }
    if (row.platform === 'meta_ads') {
      existing.metaAccountId = row.accountId;
      existing.metaAccountName = row.accountName;
    }

    existing.label = `${row.workspaceName}${existing.googleAccountName ? ` | ${existing.googleAccountName}` : ''}${existing.metaAccountName ? ' | Meta' : ''}`;
    byWorkspace.set(row.workspaceId, existing);
  }

  return Array.from(byWorkspace.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildDeterministicAlerts(input: {
  accountId: string;
  accountName: string;
  campaigns: Array<{ campaignId: string; name: string; status: string; spend: number; conversions: number; impressions: number }>;
  primaryCount: number;
  recommendedPrimaryMax: number;
  metaWinnerCampaignName?: string | null;
}): NavigatorAlert[] {
  let items: NavigatorAlert[] = [];

  for (const campaign of input.campaigns) {
    if (campaign.spend > 100 && campaign.conversions <= 2) {
      items.push({
        alertId: `g-high-${campaign.campaignId}`,
        platform: 'google',
        severity: 'critical',
        entityType: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.name,
        code: 'HIGH_SPEND_LOW_RETURN',
        message: `High spend with only ${campaign.conversions} conversions`,
        cta: 'open_campaign',
      });
    }
    if (campaign.status === 'ENABLED' && campaign.spend > 50 && campaign.conversions === 0) {
      items.push({
        alertId: `g-zero-${campaign.campaignId}`,
        platform: 'google',
        severity: 'warning',
        entityType: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.name,
        code: 'ZERO_CONVERSION_CAMPAIGN',
        message: 'Active with spend but zero conversions in selected range',
        cta: 'open_campaign',
      });
    }
    if (campaign.status === 'ENABLED' && campaign.impressions === 0) {
      items.push({
        alertId: `g-noimp-${campaign.campaignId}`,
        platform: 'google',
        severity: 'warning',
        entityType: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.name,
        code: 'NO_IMPRESSIONS_ACTIVE',
        message: 'Enabled campaign with no impressions in selected range',
        cta: 'open_campaign',
      });
    }
  }

  if (input.primaryCount > input.recommendedPrimaryMax) {
    items.push({
      alertId: 'g-primary-count',
      platform: 'google',
      severity: 'warning',
      entityType: 'account',
      entityId: input.accountId,
      entityName: input.accountName,
      code: 'TOO_MANY_PRIMARY_ACTIONS',
      message: `${input.primaryCount} primary actions may be too many`,
      cta: 'open_conversions',
    });
  }

  if (input.metaWinnerCampaignName) {
    items.push({
      alertId: 'm-ended-winner',
      platform: 'meta',
      severity: 'warning',
      entityType: 'campaign',
      entityId: input.metaWinnerCampaignName,
      entityName: input.metaWinnerCampaignName,
      code: 'ENDED_WINNER',
      message: `${input.metaWinnerCampaignName} is the current winner to review on Meta`,
      cta: 'open_meta',
    });
  }

  return items;
}

export async function getAccountSummary(workspaceId: string, dateRange: AdsNavigatorDateRange) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:summary:${dateRange}`, ttlFor('account'), async () => {
    const client = await getClientForWorkspace(workspaceId);
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    const performance = await getAccountPerformance(client.accessToken, client.customerId, {
      dateRange,
      loginCustomerId: client.loginCustomerId,
    });
    const campaignReport = await listCampaigns(client.accessToken, client.customerId, {
      dateRange,
      loginCustomerId: client.loginCustomerId,
    });
    const conversions = await getConversionActions(workspaceId, dateRange);
    const meta = await getMetaOverview(workspaceId, dateRange);

    const ranked = campaignReport.campaigns
      .map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        spend: campaign.metrics.cost,
        conversions: campaign.metrics.conversions,
        cpa: campaign.metrics.conversions > 0 ? campaign.metrics.cost / campaign.metrics.conversions : null,
      }))
      .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));

    const worst = ranked
      .filter((item) => item.cpa !== null)
      .sort((a, b) => (b.cpa || 0) - (a.cpa || 0))[0];

    return {
      account: {
        platform: 'google',
        accountId: client.customerId,
        accountName: client.connection.accountName || workspace?.name || 'Google Ads',
        currency: client.connection.metadata?.currencyCode || 'GBP',
        timezone: client.connection.metadata?.timeZone || 'UTC',
      },
      dateRange,
      summary: {
        spend: performance.cost,
        clicks: performance.clicks,
        impressions: performance.impressions,
        ctr: performance.ctr,
        conversions: performance.conversions,
        cpa: performance.conversions > 0 ? performance.cost / performance.conversions : 0,
      },
      campaignCounts: {
        active: campaignReport.campaigns.filter((campaign) => campaign.status === 'ENABLED').length,
        paused: campaignReport.campaigns.filter((campaign) => campaign.status === 'PAUSED').length,
      },
      highlights: {
        topCampaignName: ranked[0]?.name || null,
        topCampaignId: ranked[0]?.id || null,
        worstCpaCampaignName: worst?.name || null,
        worstCpa: worst?.cpa || null,
      },
      alerts: buildDeterministicAlerts({
        accountId: client.customerId,
        accountName: client.connection.accountName || workspace?.name || 'Google Ads',
        campaigns: campaignReport.campaigns.map((campaign) => ({
          campaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
          spend: campaign.metrics.cost,
          conversions: campaign.metrics.conversions,
          impressions: campaign.metrics.impressions,
        })),
        primaryCount: conversions.audit.primaryCount,
        recommendedPrimaryMax: conversions.audit.recommendedPrimaryMax,
        metaWinnerCampaignName: meta.highlights.winnerCampaignName,
      }),
      conversionsAudit: conversions.audit,
      freshness: freshness('cache'),
    };
  });
}

export async function getCampaignList(workspaceId: string, dateRange: AdsNavigatorDateRange, filter: string, sort: string, page: number, pageSize: number) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:campaigns:${dateRange}:${filter}:${sort}:${page}:${pageSize}`, ttlFor('campaigns'), async () => {
    const client = await getClientForWorkspace(workspaceId);
    const report = await listCampaigns(client.accessToken, client.customerId, {
      dateRange,
      loginCustomerId: client.loginCustomerId,
    });

    let items = report.campaigns.map((campaign) => ({
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: campaign.metrics.cost,
      clicks: campaign.metrics.clicks,
      conversions: campaign.metrics.conversions,
      cpa: campaign.metrics.conversions > 0 ? campaign.metrics.cost / campaign.metrics.conversions : null,
      ctr: campaign.metrics.ctr,
      impressions: campaign.metrics.impressions,
    }));

    if (filter === 'active') items = items.filter((item) => item.status === 'ENABLED');
    if (sort === 'cpa_desc') items.sort((a, b) => (b.cpa || -1) - (a.cpa || -1) || a.name.localeCompare(b.name));
    else items.sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      accountName: client.connection.accountName || 'Google Ads',
      currency: client.connection.metadata?.currencyCode || 'GBP',
      dateRange,
      filterLabel: filter === 'active' ? 'Active only' : 'All statuses',
      sortLabel: sort === 'cpa_desc' ? 'CPA' : 'Spend',
      page: safePage,
      totalPages,
      total,
      items: items.slice(start, start + pageSize),
      rankedCampaignIds: items.map((item) => item.campaignId),
      freshness: freshness('cache'),
    };
  });
}

export async function getCampaignDetail(workspaceId: string, campaignId: string, dateRange: AdsNavigatorDateRange) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:campaign:${campaignId}:${dateRange}`, ttlFor('campaign'), async () => {
    const client = await getClientForWorkspace(workspaceId);
    const campaign = await getCampaign(client.accessToken, client.customerId, campaignId, {
      dateRange,
      loginCustomerId: client.loginCustomerId,
    });
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const spend = campaign.metrics.cost;
    const conversions = campaign.metrics.conversions;
    const reasons: string[] = [];
    if (spend > 100 && conversions <= 2) reasons.push('High spend, low conversion output');
    if (conversions === 0 && spend > 50) reasons.push('Zero conversions in selected range');
    if (campaign.metrics.impressions === 0 && campaign.status === 'ENABLED') reasons.push('Enabled campaign with no impressions');
    if (reasons.length === 0) reasons.push('No deterministic alert fired for this campaign');

    return {
      accountId: client.customerId,
      campaign: {
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channelType: campaign.advertisingChannelType,
        biddingStrategy: campaign.biddingStrategyType,
        dailyBudget: campaign.budget?.amount || 0,
        currency: client.connection.metadata?.currencyCode || 'GBP',
      },
      dateRange,
      metrics: {
        spend,
        clicks: campaign.metrics.clicks,
        impressions: campaign.metrics.impressions,
        ctr: campaign.metrics.ctr,
        avgCpc: campaign.metrics.averageCpc,
        conversions,
        cpa: conversions > 0 ? spend / conversions : null,
      },
      health: {
        score: reasons[0].startsWith('No deterministic') ? 80 : 35,
        status: reasons[0].startsWith('No deterministic') ? 'healthy' : 'critical',
        reasons,
      },
      freshness: freshness('cache'),
    };
  });
}

export async function getSearchTerms(workspaceId: string, campaignId: string, dateRange: AdsNavigatorDateRange, filter: string, page: number, pageSize: number) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:terms:${campaignId}:${dateRange}:${filter}:${page}:${pageSize}`, ttlFor('search_terms'), async () => {
    const client = await getClientForWorkspace(workspaceId);
    const campaign = await getCampaignDetail(workspaceId, campaignId, dateRange);
    let items = await getSearchTermsReport(client.accessToken, client.customerId, {
      dateRange,
      campaignId,
      loginCustomerId: client.loginCustomerId,
    });

    items = items.map((item) => ({
      ...item,
      cpa: item.conversions > 0 ? item.cost / item.conversions : null,
      flag: item.conversions === 0 && item.cost > 25 ? 'waste' : item.conversions > 0 ? 'winner' : 'neutral',
      spend: item.cost,
    }));

    if (filter === 'waste') items = items.filter((item) => item.flag === 'waste');
    if (filter === 'winners') items = items.filter((item) => item.flag === 'winner').sort((a, b) => b.conversions - a.conversions || a.searchTerm.localeCompare(b.searchTerm));
    else items.sort((a, b) => b.spend - a.spend || a.searchTerm.localeCompare(b.searchTerm));

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const zeroConversionSpend = items.filter((item) => item.conversions === 0).reduce((sum, item) => sum + item.spend, 0);

    return {
      accountId: client.customerId,
      campaignId,
      campaignName: campaign.campaign.name,
      currency: campaign.campaign.currency,
      dateRange,
      page: safePage,
      totalPages,
      items: items.slice(start, start + pageSize).map((item) => ({
        searchTerm: item.searchTerm,
        clicks: item.clicks,
        impressions: item.impressions,
        conversions: item.conversions,
        spend: item.spend,
        cpa: item.cpa,
      })),
      zeroConversionSpend,
      freshness: freshness('cache'),
    };
  });
}

export async function getConversionActions(workspaceId: string, dateRange: AdsNavigatorDateRange, filter = 'all', page = 1, pageSize = 5) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:conversions:${dateRange}:${filter}:${page}:${pageSize}`, ttlFor('conversions'), async () => {
    const client = await getClientForWorkspace(workspaceId);
    const query = `
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.category,
        conversion_action.type,
        conversion_action.status,
        conversion_action.primary_for_goal,
        metrics.all_conversions
      FROM conversion_action
      WHERE segments.date DURING ${dateRange}
    `;
    const rows = await gaqlSearch(client.accessToken, client.customerId, query, client.loginCustomerId);

    let items = rows.map((row: any) => ({
      conversionActionId: String(row.conversionAction?.id || ''),
      name: row.conversionAction?.name || 'Unnamed action',
      category: row.conversionAction?.category || 'UNKNOWN',
      source: row.conversionAction?.type || 'UNKNOWN',
      status: row.conversionAction?.status || 'UNKNOWN',
      primary: Boolean(row.conversionAction?.primaryForGoal),
      conversions: Number(row.metrics?.allConversions || 0),
    }));

    items.sort((a, b) => b.conversions - a.conversions || a.name.localeCompare(b.name));
    if (filter === 'primary') items = items.filter((item) => item.primary);
    if (filter === 'secondary') items = items.filter((item) => !item.primary);

    const enabledCount = items.filter((item) => item.status === 'ENABLED').length;
    const primaryCount = items.filter((item) => item.primary).length;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      accountId: client.customerId,
      accountName: client.connection.accountName || 'Google Ads',
      dateRange,
      page: safePage,
      totalPages,
      items: items.slice(start, start + pageSize),
      audit: {
        enabledCount,
        primaryCount,
        recommendedPrimaryMax: 5,
      },
      freshness: freshness('cache'),
    };
  });
}

export async function getMetaOverview(workspaceId: string, dateRange: AdsNavigatorDateRange) {
  return cacheGetOrFetch(`adsnav:${workspaceId}:meta:${dateRange}`, ttlFor('meta_overview'), async () => {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    const [integration] = await db
      .select()
      .from(workspaceIntegrations)
      .where(and(eq(workspaceIntegrations.workspaceId, workspaceId), eq(workspaceIntegrations.platform, 'meta_ads')));

    if (!integration || !integration.accessToken) {
      return {
        account: { platform: 'meta', accountId: '', accountName: workspace?.name || 'Meta Ads', currency: 'GBP', timezone: 'UTC' },
        dateRange,
        summary: { spend: 0, purchases: 0, cpa: null, activeCampaigns: 0, pausedCampaigns: 0, endedCampaigns: 0 },
        highlights: { winnerCampaignName: null, winnerCpa: null, lines: ['• Meta account mapping is missing for this client.'] },
        freshness: freshness('computed'),
      };
    }

    const accessToken = await ensureFreshMetaToken(integration);
    const metadata = (integration.metadata || {}) as Record<string, any>;
    const adAccountId = metadata.selectedAdAccountId || integration.accountId;
    const datePreset = toMetaDatePreset(dateRange);

    const campaignsUrl = new URL(`${GRAPH_BASE}/act_${adAccountId}/campaigns`);
    campaignsUrl.searchParams.set('fields', 'name,status,effective_status,objective,stop_time');
    campaignsUrl.searchParams.set('limit', '100');
    campaignsUrl.searchParams.set('access_token', accessToken);

    const insightsUrl = new URL(`${GRAPH_BASE}/act_${adAccountId}/insights`);
    insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,actions');
    insightsUrl.searchParams.set('date_preset', datePreset);
    insightsUrl.searchParams.set('level', 'campaign');
    insightsUrl.searchParams.set('limit', '100');
    insightsUrl.searchParams.set('access_token', accessToken);

    const [campaignsRes, insightsRes] = await Promise.all([fetch(campaignsUrl.toString()), fetch(insightsUrl.toString())]);
    const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { data: [] };
    const insightsData = insightsRes.ok ? await insightsRes.json() : { data: [] };
    const insightsMap = new Map<string, any>((insightsData.data || []).map((row: any) => [row.campaign_id, row]));

    const merged = (campaignsData.data || []).map((campaign: any) => {
      const insight = insightsMap.get(campaign.id) || {};
      const purchases = Number((insight.actions || []).find((action: any) => String(action.action_type).includes('purchase'))?.value || 0);
      const spend = Number(insight.spend || 0);
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.effective_status || campaign.status,
        spend,
        purchases,
        cpa: purchases > 0 ? spend / purchases : null,
        stopTime: campaign.stop_time || null,
      };
    });

    const winner = [...merged].filter((item) => item.purchases > 0).sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name))[0];
    const wasted = [...merged].filter((item) => item.spend > 0 && item.purchases === 0).sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))[0];
    const spend = merged.reduce((sum, item) => sum + item.spend, 0);
    const purchases = merged.reduce((sum, item) => sum + item.purchases, 0);

    return {
      account: {
        platform: 'meta',
        accountId: adAccountId,
        accountName: integration.accountName || workspace?.name || 'Meta Ads',
        currency: 'GBP',
        timezone: 'UTC',
      },
      dateRange,
      summary: {
        spend,
        purchases,
        cpa: purchases > 0 ? spend / purchases : null,
        activeCampaigns: merged.filter((item) => item.status === 'ACTIVE').length,
        pausedCampaigns: merged.filter((item) => item.status === 'PAUSED').length,
        endedCampaigns: merged.filter((item) => item.status === 'COMPLETED').length,
      },
      highlights: {
        winnerCampaignName: winner?.name || null,
        winnerCpa: winner?.cpa || null,
        lines: [
          winner ? `🟢 ${winner.name} drove ${winner.purchases} purchases in the selected range` : '• No winning Meta campaign found in the selected range',
          wasted ? `🟡 ${wasted.name} spent ${wasted.spend.toFixed(2)} with 0 purchases` : '• No wasted-spend Meta campaign found',
        ],
      },
      freshness: freshness('cache'),
    };
  });
}

export async function getAlerts(workspaceId: string, dateRange: AdsNavigatorDateRange, filter = 'all') {
  const campaigns = await getCampaignList(workspaceId, dateRange, 'all', 'spend_desc', 1, 100);
  const conversions = await getConversionActions(workspaceId, dateRange, 'all', 1, 100);
  const meta = await getMetaOverview(workspaceId, dateRange);

  let items = buildDeterministicAlerts({
    accountId: campaigns.items[0]?.campaignId || workspaceId,
    accountName: campaigns.accountName,
    campaigns: campaigns.items.map((campaign) => ({
      campaignId: campaign.campaignId,
      name: campaign.name,
      status: campaign.status,
      spend: campaign.spend,
      conversions: campaign.conversions,
      impressions: campaign.impressions,
    })),
    primaryCount: conversions.audit.primaryCount,
    recommendedPrimaryMax: conversions.audit.recommendedPrimaryMax,
    metaWinnerCampaignName: meta.highlights.winnerCampaignName,
  });

  if (filter === 'critical') items = items.filter((item) => item.severity === 'critical');

  return {
    accountId: workspaceId,
    accountName: campaigns.accountName,
    dateRange,
    items,
    freshness: freshness('computed'),
  };
}
