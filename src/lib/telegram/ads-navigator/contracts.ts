import { z } from 'zod';

export const adsNavigatorPlatformSchema = z.enum(['google', 'meta', 'hybrid']);
export type AdsNavigatorPlatform = z.infer<typeof adsNavigatorPlatformSchema>;

export const adsNavigatorScreenSchema = z.enum([
  'account',
  'campaigns',
  'campaign',
  'search_terms',
  'conversions',
  'alerts',
  'meta_overview',
]);
export type AdsNavigatorScreen = z.infer<typeof adsNavigatorScreenSchema>;

export const freshnessSourceSchema = z.enum(['live', 'cache', 'stale-cache', 'computed']);
export type FreshnessSource = z.infer<typeof freshnessSourceSchema>;

export const normalizedAccountStatusSchema = z.enum(['active', 'paused', 'unknown']);
export const normalizedCampaignStatusSchema = z.enum(['enabled', 'paused', 'removed', 'ended', 'unknown']);
export const normalizedObjectiveSchema = z.enum(['search', 'sales', 'leads', 'traffic', 'awareness', 'unknown']);
export const normalizedChannelSchema = z.enum(['search', 'pmax', 'display', 'video', 'social', 'unknown']);
export const normalizedBudgetTypeSchema = z.enum(['daily', 'lifetime', 'unknown']);
export const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export const alertEntityTypeSchema = z.enum(['account', 'campaign', 'conversion_action', 'search_term']);
export const alertCtaSchema = z.enum(['open_campaign', 'open_meta', 'open_conversions', 'none']);

export const freshnessSchema = z.object({
  fetchedAt: z.string().datetime(),
  cacheAgeSeconds: z.number().int().min(0),
  source: freshnessSourceSchema,
});
export type Freshness = z.infer<typeof freshnessSchema>;

export const normalizedAccountSchema = z.object({
  platform: adsNavigatorPlatformSchema,
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  currency: z.string().min(1),
  timezone: z.string().min(1),
  status: normalizedAccountStatusSchema.default('unknown'),
});
export type NormalizedAccount = z.infer<typeof normalizedAccountSchema>;

export const normalizedMetricsSchema = z.object({
  spend: z.number().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  ctr: z.number().min(0).nullable().default(0),
  conversions: z.number().min(0).default(0),
  primaryConversions: z.number().min(0).nullable().default(null),
  purchases: z.number().min(0).nullable().default(null),
  leads: z.number().min(0).nullable().default(null),
  cpa: z.number().min(0).nullable().default(null),
  cpc: z.number().min(0).nullable().default(null),
  roas: z.number().min(0).nullable().default(null),
});
export type NormalizedMetrics = z.infer<typeof normalizedMetricsSchema>;

export const normalizedCampaignSchema = z.object({
  platform: adsNavigatorPlatformSchema,
  accountId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  status: normalizedCampaignStatusSchema.default('unknown'),
  objective: normalizedObjectiveSchema.default('unknown'),
  channel: normalizedChannelSchema.default('unknown'),
  budgetType: normalizedBudgetTypeSchema.default('unknown'),
  budgetAmount: z.number().min(0).nullable().default(null),
  currency: z.string().min(1),
});
export type NormalizedCampaign = z.infer<typeof normalizedCampaignSchema>;

export const alertSchema = z.object({
  alertId: z.string().min(1),
  platform: adsNavigatorPlatformSchema,
  severity: alertSeveritySchema,
  entityType: alertEntityTypeSchema,
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  cta: alertCtaSchema.default('none'),
});
export type NavigatorAlert = z.infer<typeof alertSchema>;

export const googleAccountSummarySchema = z.object({
  account: normalizedAccountSchema.extend({ platform: z.literal('google') }),
  dateRange: z.string().min(1),
  summary: normalizedMetricsSchema.pick({
    spend: true,
    clicks: true,
    impressions: true,
    ctr: true,
    conversions: true,
    cpa: true,
    roas: true,
  }),
  campaignCounts: z.object({
    active: z.number().int().min(0),
    paused: z.number().int().min(0),
  }),
  highlights: z.object({
    topCampaignName: z.string().nullable(),
    topCampaignId: z.string().nullable(),
    worstCpaCampaignName: z.string().nullable(),
    worstCpa: z.number().min(0).nullable(),
  }),
  alerts: z.array(alertSchema),
  freshness: freshnessSchema,
});
export type GoogleAccountSummary = z.infer<typeof googleAccountSummarySchema>;

export const campaignListItemSchema = z.object({
  campaignId: z.string().min(1),
  platform: adsNavigatorPlatformSchema,
  name: z.string().min(1),
  status: z.string().min(1),
  spend: z.number().min(0),
  clicks: z.number().int().min(0),
  conversions: z.number().min(0),
  cpa: z.number().min(0).nullable(),
  ctr: z.number().min(0).nullable(),
  impressions: z.number().int().min(0),
  alerts: z.array(z.string()),
});
export type CampaignListItem = z.infer<typeof campaignListItemSchema>;

export const googleCampaignListSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  dateRange: z.string().min(1),
  filter: z.string().min(1),
  sort: z.string().min(1),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  items: z.array(campaignListItemSchema),
  freshness: freshnessSchema,
});
export type GoogleCampaignList = z.infer<typeof googleCampaignListSchema>;

export const googleCampaignDetailSchema = z.object({
  accountId: z.string().min(1),
  campaign: z.object({
    campaignId: z.string().min(1),
    platform: z.literal('google'),
    name: z.string().min(1),
    status: z.string().min(1),
    channelType: z.string().min(1),
    biddingStrategy: z.string().nullable(),
    dailyBudget: z.number().min(0).nullable(),
    currency: z.string().min(1),
  }),
  dateRange: z.string().min(1),
  metrics: z.object({
    spend: z.number().min(0),
    clicks: z.number().int().min(0),
    impressions: z.number().int().min(0),
    ctr: z.number().min(0).nullable(),
    avgCpc: z.number().min(0).nullable(),
    conversions: z.number().min(0),
    cpa: z.number().min(0).nullable(),
  }),
  health: z.object({
    score: z.number().int().min(0).max(100),
    status: z.enum(['healthy', 'warning', 'critical']),
    reasons: z.array(z.string()),
  }),
  freshness: freshnessSchema,
});
export type GoogleCampaignDetail = z.infer<typeof googleCampaignDetailSchema>;

export const searchTermItemSchema = z.object({
  searchTerm: z.string().min(1),
  matchContext: z.string().nullable(),
  spend: z.number().min(0),
  clicks: z.number().int().min(0),
  impressions: z.number().int().min(0),
  conversions: z.number().min(0),
  ctr: z.number().min(0).nullable(),
  cpa: z.number().min(0).nullable(),
  flag: z.enum(['waste', 'winner', 'neutral']),
});
export type SearchTermItem = z.infer<typeof searchTermItemSchema>;

export const googleSearchTermsSchema = z.object({
  accountId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  dateRange: z.string().min(1),
  filter: z.enum(['all', 'waste', 'winners']),
  sort: z.string().min(1),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  items: z.array(searchTermItemSchema),
  summary: z.object({
    zeroConversionSpend: z.number().min(0),
    winnerCount: z.number().int().min(0),
  }),
  freshness: freshnessSchema,
});
export type GoogleSearchTerms = z.infer<typeof googleSearchTermsSchema>;

export const conversionActionItemSchema = z.object({
  conversionActionId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  source: z.string().min(1),
  status: z.string().min(1),
  primary: z.boolean(),
  conversions: z.number().min(0),
  value: z.number().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
});
export type ConversionActionItem = z.infer<typeof conversionActionItemSchema>;

export const googleConversionActionsSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  dateRange: z.string().min(1),
  filter: z.enum(['all', 'primary', 'secondary']),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  items: z.array(conversionActionItemSchema),
  audit: z.object({
    enabledCount: z.number().int().min(0),
    primaryCount: z.number().int().min(0),
    recommendedPrimaryMax: z.number().int().min(0),
    flags: z.array(z.string()),
  }),
  freshness: freshnessSchema,
});
export type GoogleConversionActions = z.infer<typeof googleConversionActionsSchema>;

export const alertsViewSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  dateRange: z.string().min(1),
  filter: z.enum(['all', 'critical']),
  items: z.array(alertSchema),
  freshness: freshnessSchema,
});
export type AlertsView = z.infer<typeof alertsViewSchema>;

export const metaOverviewSchema = z.object({
  account: normalizedAccountSchema.extend({ platform: z.literal('meta') }),
  dateRange: z.string().min(1),
  summary: z.object({
    spend: z.number().min(0),
    purchases: z.number().min(0),
    cpa: z.number().min(0).nullable(),
    activeCampaigns: z.number().int().min(0),
    pausedCampaigns: z.number().int().min(0),
    endedCampaigns: z.number().int().min(0),
  }),
  highlights: z.object({
    winnerCampaignName: z.string().nullable(),
    winnerCampaignId: z.string().nullable(),
    winnerSpend: z.number().min(0).nullable(),
    winnerPurchases: z.number().min(0).nullable(),
    winnerCpa: z.number().min(0).nullable(),
    wastedCampaignName: z.string().nullable(),
    wastedSpend: z.number().min(0).nullable(),
    wastedPurchases: z.number().min(0).nullable(),
  }),
  freshness: freshnessSchema,
});
export type MetaOverview = z.infer<typeof metaOverviewSchema>;

export const navigatorPayloadSchema = z.union([
  googleAccountSummarySchema,
  googleCampaignListSchema,
  googleCampaignDetailSchema,
  googleSearchTermsSchema,
  googleConversionActionsSchema,
  alertsViewSchema,
  metaOverviewSchema,
]);
export type NavigatorPayload = z.infer<typeof navigatorPayloadSchema>;
