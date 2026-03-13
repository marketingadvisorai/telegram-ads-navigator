import {
  renderAccountSummary,
  renderAlerts,
  renderCampaignDetail,
  renderCampaignList,
  renderConversionActions,
  renderMetaOverview,
  renderSearchTerms,
} from './renderers.ts';
import type { ViewState } from './types.ts';

const baseState: ViewState = {
  version: 1,
  platform: 'google',
  screen: 'account',
  account_id: '2910561991',
  date_range: 'LAST_30_DAYS',
  page: 1,
  page_size: 5,
  sort: 'spend_desc',
  filter: 'active',
  state_id: 's8fd2a',
};

const outputs = {
  account: renderAccountSummary(
    {
      account: { platform: 'google', account_id: '2910561991', account_name: 'ScreamWorks', currency: 'GBP' },
      date_range: 'LAST_30_DAYS',
      summary: { spend: 3547, clicks: 7340, conversions: 96, cpa: 36.95, ctr: 0.081 },
      campaign_counts: { active: 6, paused: 22 },
      highlights: { top_campaign_name: 'Escape Rooms MOF', worst_cpa: 517 },
      alerts: [
        { severity: 'critical', message: 'Escape Rooms MOF spent heavily for only 2 conversions' },
        { severity: 'warning', message: '10 of 16 conversion actions are primary' },
      ],
      conversion_actions: { enabled: 16 },
      freshness: { source: 'cache', cache_age_seconds: 480 },
    },
    baseState,
  ),
  campaigns: renderCampaignList(
    {
      account_id: '2910561991',
      account_name: 'ScreamWorks',
      date_range: 'LAST_30_DAYS',
      filter: 'active',
      sort: 'spend_desc',
      page: 1,
      page_size: 5,
      total: 6,
      items: [
        { campaign_id: '123', platform: 'google', name: 'Escape Rooms MOF', status: 'ENABLED', spend: 1035, conversions: 2, cpa: 517 },
        { campaign_id: '124', platform: 'google', name: 'Corporate Team Building', status: 'ENABLED', spend: 48, conversions: 3, cpa: 16 },
        { campaign_id: '125', platform: 'google', name: 'Events Campaign', status: 'ENABLED', spend: 32, conversions: 1, cpa: 32 },
        { campaign_id: '126', platform: 'google', name: 'Brand Search', status: 'ENABLED', spend: 410, conversions: 22, cpa: 18.64 },
        { campaign_id: '127', platform: 'google', name: 'Generic Escape Room', status: 'ENABLED', spend: 629, conversions: 14, cpa: 44.93 },
      ],
      freshness: { source: 'cache', cache_age_seconds: 480 },
    },
    { ...baseState, screen: 'campaigns' },
  ),
  campaign: renderCampaignDetail(
    {
      account_id: '2910561991',
      date_range: 'LAST_30_DAYS',
      campaign: {
        campaign_id: '123',
        platform: 'google',
        name: 'Escape Rooms MOF',
        status: 'ENABLED',
        channel_type: 'SEARCH',
        bidding_strategy: 'MAXIMIZE_CONVERSIONS',
        daily_budget: 35,
        currency: 'GBP',
      },
      metrics: { spend: 1035, clicks: 1880, conversions: 2, cpa: 517.5, ctr: 0.073, avg_cpc: 0.55 },
      health: { status: 'critical', reasons: ['high_spend_low_return', 'check_search_terms_for_waste', 'confirm_conversion_tracking_quality'] },
      freshness: { source: 'live', cache_age_seconds: 0 },
    },
    { ...baseState, screen: 'campaign', campaign_id: '123' },
  ),
  searchTerms: renderSearchTerms(
    {
      account_id: '2910561991',
      campaign_id: '123',
      campaign_name: 'Escape Rooms MOF',
      date_range: 'LAST_30_DAYS',
      filter: 'all',
      sort: 'spend_desc',
      page: 1,
      page_size: 5,
      total: 17,
      items: [
        { search_term: 'escape room near me', spend: 148, clicks: 210, conversions: 0 },
        { search_term: 'scary escape room london', spend: 76, clicks: 84, conversions: 3 },
        { search_term: 'horror escape experience', spend: 64, clicks: 51, conversions: 1 },
        { search_term: 'best team building london', spend: 53, clicks: 72, conversions: 0 },
        { search_term: 'escape room birthday party', spend: 49, clicks: 61, conversions: 2 },
      ],
      summary: { zero_conversion_spend: 312, winner_count: 5 },
      freshness: { source: 'cache', cache_age_seconds: 600 },
    },
    { ...baseState, screen: 'search_terms', campaign_id: '123' },
  ),
  conversions: renderConversionActions(
    {
      account_id: '2910561991',
      account_name: 'ScreamWorks',
      date_range: 'LAST_30_DAYS',
      filter: 'all',
      page: 1,
      page_size: 5,
      total: 16,
      items: [
        { conversion_action_id: '1', name: 'Purchase GADS', status: 'ENABLED', primary: true, conversions: 21 },
        { conversion_action_id: '2', name: 'Purchase GA4', status: 'ENABLED', primary: true, conversions: 18 },
        { conversion_action_id: '3', name: 'Begin Checkout', status: 'ENABLED', primary: true, conversions: 29 },
        { conversion_action_id: '4', name: 'Contact Form', status: 'ENABLED', primary: true, conversions: 8 },
        { conversion_action_id: '5', name: 'Page View', status: 'ENABLED', primary: false, conversions: 412 },
      ],
      audit: { enabled_count: 16, primary_count: 10, recommended_primary_max: 5, flags: ['too_many_primary_actions'] },
      freshness: { source: 'cache', cache_age_seconds: 840 },
    },
    { ...baseState, screen: 'conversions' },
  ),
  alerts: renderAlerts(
    {
      account_id: '2910561991',
      account_name: 'ScreamWorks',
      date_range: 'LAST_30_DAYS',
      filter: 'all',
      items: [
        { alert_id: 'a1', severity: 'critical', platform: 'google', entity_type: 'campaign', entity_id: '123', entity_name: 'Escape Rooms MOF', code: 'HIGH_SPEND_LOW_RETURN', message: 'High spend with only 2 conversions', cta: 'open_campaign' },
        { alert_id: 'a2', severity: 'warning', platform: 'google', entity_type: 'account', entity_id: '2910561991', entity_name: 'Conversion setup', code: 'TOO_MANY_PRIMARY_ACTIONS', message: '10 primary actions may be too many', cta: 'open_conversions' },
        { alert_id: 'a3', severity: 'warning', platform: 'meta', entity_type: 'campaign', entity_id: 'tb1', entity_name: 'Meta Team Building', code: 'ENDED_WINNER', message: 'Strong past performer ended on Mar 7', cta: 'open_meta' },
      ],
      freshness: { source: 'computed', cache_age_seconds: 300 },
    },
    { ...baseState, screen: 'alerts' },
  ),
  meta: renderMetaOverview(
    {
      account: { platform: 'meta', account_id: 'act_1042551150662411', account_name: 'ScreamWorks', currency: 'GBP' },
      date_range: 'LAST_30_DAYS',
      summary: { spend: 700, purchases: 33, cpa: 21.21, active_campaigns: 0, paused_campaigns: 10, ended_campaigns: 2 },
      highlights: { winner_campaign_name: 'Team Building', winner_purchases: 25, winner_cpa: 18.07, wasted_campaign_name: 'Escape Room Bookings', wasted_spend: 119, wasted_purchases: 0 },
      freshness: { source: 'cache', cache_age_seconds: 660 },
    },
    { ...baseState, platform: 'meta', screen: 'meta_overview', account_id: 'act_1042551150662411' },
  ),
};

console.log(JSON.stringify(outputs, null, 2));
