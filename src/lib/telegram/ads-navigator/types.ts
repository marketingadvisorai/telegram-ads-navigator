export type AdsNavigatorPlatform = 'google' | 'meta' | 'hybrid';

export type AdsNavigatorScreen =
  | 'account_picker'
  | 'account'
  | 'campaigns'
  | 'campaign'
  | 'search_terms'
  | 'conversions'
  | 'alerts'
  | 'meta_overview';

export type AdsNavigatorDateRange = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS';
export type AdsNavigatorDateToken = '7d' | '30d' | '90d';
export type AdsNavigatorFilter = 'active' | 'all' | 'waste' | 'winners' | 'primary' | 'secondary' | 'critical';
export type AdsNavigatorSort = 'spend_desc' | 'cpa_desc' | 'conversions_desc';

export interface ParentState {
  screen: AdsNavigatorScreen;
  page?: number;
  filter?: AdsNavigatorFilter;
  sort?: AdsNavigatorSort;
}

export interface AdsNavigatorViewState {
  version: 1;
  screen: AdsNavigatorScreen;
  platform: AdsNavigatorPlatform;
  workspaceId?: string;
  accountId?: string;
  campaignId?: string;
  campaignIndex?: number;
  dateRange: AdsNavigatorDateRange;
  page: number;
  pageSize: number;
  sort: AdsNavigatorSort;
  filter: AdsNavigatorFilter;
  messageId?: number;
  chatId: number;
  parent?: ParentState;
  accountPicker?: Array<{ workspaceId: string; label: string }>;
}

export interface NavigatorFreshness {
  fetchedAt: string;
  cacheAgeSeconds: number;
  source: 'live' | 'cache' | 'stale-cache' | 'computed';
}

export interface NavigatorAlert {
  alertId: string;
  platform: 'google' | 'meta' | 'hybrid';
  severity: 'info' | 'warning' | 'critical';
  entityType: 'account' | 'campaign' | 'conversion_action' | 'search_term';
  entityId: string;
  entityName: string;
  code: string;
  message: string;
  cta: 'open_campaign' | 'open_meta' | 'open_conversions' | 'none';
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramMessagePayload {
  text: string;
  reply_markup: TelegramInlineKeyboardMarkup;
  parse_mode?: 'HTML';
}

export interface TelegramUser {
  id: number;
}

export interface TelegramChat {
  id: number;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface AccountPickerItem {
  workspaceId: string;
  label: string;
  workspaceName: string;
  googleAccountId?: string | null;
  googleAccountName?: string | null;
  metaAccountId?: string | null;
  metaAccountName?: string | null;
}
