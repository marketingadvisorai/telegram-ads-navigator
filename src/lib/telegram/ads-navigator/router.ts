import {
  accountPickerKeyboard,
  accountSummaryKeyboard,
  alertsKeyboard,
  campaignDetailKeyboard,
  campaignListKeyboard,
  conversionsKeyboard,
  metaOverviewKeyboard,
  searchTermsKeyboard,
} from './keyboards';
import {
  renderAccountPicker,
  renderAccountSummary,
  renderAlerts,
  renderCampaignDetail,
  renderCampaignList,
  renderConversions,
  renderMetaOverview,
  renderSearchTerms,
} from './renderers';
import { dateTokenToRange } from './callbacks';
import {
  getAccountSummary,
  getAlerts,
  getCampaignDetail,
  getCampaignList,
  getConversionActions,
  getMetaOverview,
  getSearchTerms,
} from './service';
import type { AdsNavigatorViewState, TelegramMessagePayload } from './types';

export async function renderState(stateId: string, state: AdsNavigatorViewState): Promise<TelegramMessagePayload> {
  switch (state.screen) {
    case 'account_picker':
      return {
        text: renderAccountPicker((state.accountPicker || []).map((item) => ({ label: item.label }))),
        reply_markup: accountPickerKeyboard(stateId, state),
        parse_mode: 'HTML',
      };
    case 'campaigns': {
      const view = await getCampaignList(state.workspaceId!, state.dateRange, state.filter, state.sort, state.page, state.pageSize);
      return {
        text: renderCampaignList(view),
        reply_markup: campaignListKeyboard(stateId, state, view.items.length),
        parse_mode: 'HTML',
      };
    }
    case 'campaign': {
      const view = await getCampaignDetail(state.workspaceId!, state.campaignId!, state.dateRange);
      return {
        text: renderCampaignDetail(view),
        reply_markup: campaignDetailKeyboard(stateId),
        parse_mode: 'HTML',
      };
    }
    case 'search_terms': {
      const view = await getSearchTerms(state.workspaceId!, state.campaignId!, state.dateRange, state.filter, state.page, state.pageSize);
      return {
        text: renderSearchTerms(view),
        reply_markup: searchTermsKeyboard(stateId, state),
        parse_mode: 'HTML',
      };
    }
    case 'conversions': {
      const view = await getConversionActions(state.workspaceId!, state.dateRange, state.filter, state.page, state.pageSize);
      return {
        text: renderConversions(view),
        reply_markup: conversionsKeyboard(stateId, state),
        parse_mode: 'HTML',
      };
    }
    case 'alerts': {
      const view = await getAlerts(state.workspaceId!, state.dateRange, state.filter);
      return {
        text: renderAlerts(view),
        reply_markup: alertsKeyboard(stateId, view.items.some((item) => item.platform === 'meta'), state.filter),
        parse_mode: 'HTML',
      };
    }
    case 'meta_overview': {
      const view = await getMetaOverview(state.workspaceId!, state.dateRange);
      return {
        text: renderMetaOverview(view),
        reply_markup: metaOverviewKeyboard(stateId, state),
        parse_mode: 'HTML',
      };
    }
    case 'account':
    default: {
      const view = await getAccountSummary(state.workspaceId!, state.dateRange);
      return {
        text: renderAccountSummary(view),
        reply_markup: accountSummaryKeyboard(stateId, state),
        parse_mode: 'HTML',
      };
    }
  }
}

export function applyRange(state: AdsNavigatorViewState, token: '7d' | '30d' | '90d'): AdsNavigatorViewState {
  return { ...state, dateRange: dateTokenToRange(token), page: 1 };
}
