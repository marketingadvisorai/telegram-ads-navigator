import { buildCallback, rangeToDateToken } from './callbacks';
import type { AdsNavigatorViewState, TelegramInlineKeyboardMarkup } from './types';

export function accountPickerKeyboard(stateId: string, state: AdsNavigatorViewState): TelegramInlineKeyboardMarkup {
  const rows = (state.accountPicker || []).map((item, index) => ([
    { text: item.label, callback_data: buildCallback('pick', stateId, `a${index + 1}`) },
  ]));
  return { inline_keyboard: rows };
}

export function accountSummaryKeyboard(stateId: string, state: AdsNavigatorViewState): TelegramInlineKeyboardMarkup {
  const token = rangeToDateToken(state.dateRange);
  return {
    inline_keyboard: [
      [
        { text: 'Campaigns', callback_data: buildCallback('open', stateId, 'camp') },
        { text: 'Alerts', callback_data: buildCallback('alert', stateId, 'alts') },
      ],
      [
        { text: 'Conversions', callback_data: buildCallback('conv', stateId, 'cv') },
        { text: 'Meta Overview', callback_data: buildCallback('meta', stateId, 'meta') },
      ],
      [
        { text: token === '7d' ? '• 7D' : '7D', callback_data: buildCallback('range', stateId, '7d') },
        { text: token === '30d' ? '• 30D' : '30D', callback_data: buildCallback('range', stateId, '30d') },
        { text: token === '90d' ? '• 90D' : '90D', callback_data: buildCallback('range', stateId, '90d') },
      ],
      [
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function campaignListKeyboard(stateId: string, state: AdsNavigatorViewState, visibleCount: number): TelegramInlineKeyboardMarkup {
  const firstRow = Array.from({ length: visibleCount }, (_, index) => ({
    text: String(index + 1),
    callback_data: buildCallback('camp', stateId, `i${index + 1}`),
  }));

  return {
    inline_keyboard: [
      firstRow,
      [
        { text: state.filter === 'active' ? '• Active' : 'Active', callback_data: buildCallback('filter', stateId, 'act') },
        { text: state.filter === 'all' ? '• All' : 'All', callback_data: buildCallback('filter', stateId, 'all') },
        { text: state.sort === 'spend_desc' ? '• Sort Spend' : 'Sort Spend', callback_data: buildCallback('sort', stateId, 'spend') },
        { text: state.sort === 'cpa_desc' ? '• Sort CPA' : 'Sort CPA', callback_data: buildCallback('sort', stateId, 'cpa') },
      ],
      [
        { text: 'Prev', callback_data: buildCallback('page', stateId, 'p1') },
        { text: 'Next', callback_data: buildCallback('page', stateId, 'n1') },
      ],
      [
        { text: 'Back', callback_data: buildCallback('back', stateId, '1') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function campaignDetailKeyboard(stateId: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Search Terms', callback_data: buildCallback('open', stateId, 'st') },
        { text: 'Conversions', callback_data: buildCallback('conv', stateId, 'cv') },
      ],
      [
        { text: 'Prev Campaign', callback_data: buildCallback('campnav', stateId, 'prev') },
        { text: 'Next Campaign', callback_data: buildCallback('campnav', stateId, 'next') },
      ],
      [
        { text: 'Back to Campaigns', callback_data: buildCallback('back', stateId, '1') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function searchTermsKeyboard(stateId: string, state: AdsNavigatorViewState): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: state.filter === 'waste' ? '• Waste' : 'Waste', callback_data: buildCallback('filter', stateId, 'waste') },
        { text: state.filter === 'winners' ? '• Winners' : 'Winners', callback_data: buildCallback('filter', stateId, 'winners') },
        { text: state.filter === 'all' ? '• All' : 'All', callback_data: buildCallback('filter', stateId, 'all') },
      ],
      [
        { text: 'Prev', callback_data: buildCallback('page', stateId, 'p1') },
        { text: 'Next', callback_data: buildCallback('page', stateId, 'n1') },
      ],
      [
        { text: 'Back to Campaign', callback_data: buildCallback('back', stateId, '1') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function conversionsKeyboard(stateId: string, state: AdsNavigatorViewState): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: state.filter === 'primary' ? '• Primary' : 'Primary', callback_data: buildCallback('filter', stateId, 'primary') },
        { text: state.filter === 'secondary' ? '• Secondary' : 'Secondary', callback_data: buildCallback('filter', stateId, 'secondary') },
        { text: state.filter === 'all' ? '• All' : 'All', callback_data: buildCallback('filter', stateId, 'all') },
      ],
      [
        { text: 'Prev', callback_data: buildCallback('page', stateId, 'p1') },
        { text: 'Next', callback_data: buildCallback('page', stateId, 'n1') },
      ],
      [
        { text: 'Back', callback_data: buildCallback('back', stateId, '1') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function alertsKeyboard(stateId: string, hasMetaAlert: boolean, filter: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: filter === 'critical' ? '• Critical' : 'Critical', callback_data: buildCallback('filter', stateId, 'critical') },
        { text: filter === 'all' ? '• All' : 'All', callback_data: buildCallback('filter', stateId, 'all') },
      ],
      [
        { text: 'Open Campaign', callback_data: buildCallback('alertgo', stateId, 'campaign') },
        { text: hasMetaAlert ? 'Open Meta' : 'Meta N/A', callback_data: buildCallback('alertgo', stateId, hasMetaAlert ? 'meta' : 'none') },
      ],
      [
        { text: 'Back', callback_data: buildCallback('back', stateId, '1') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
    ],
  };
}

export function metaOverviewKeyboard(stateId: string, state: AdsNavigatorViewState): TelegramInlineKeyboardMarkup {
  const token = rangeToDateToken(state.dateRange);
  return {
    inline_keyboard: [
      [
        { text: 'Top Campaigns', callback_data: buildCallback('open', stateId, 'meta') },
        { text: 'Alerts', callback_data: buildCallback('alert', stateId, 'alts') },
      ],
      [
        { text: 'Google Summary', callback_data: buildCallback('open', stateId, 'acct') },
        { text: 'Refresh', callback_data: buildCallback('refresh', stateId, 'x') },
      ],
      [
        { text: token === '7d' ? '• 7D' : '7D', callback_data: buildCallback('range', stateId, '7d') },
        { text: token === '30d' ? '• 30D' : '30D', callback_data: buildCallback('range', stateId, '30d') },
        { text: token === '90d' ? '• 90D' : '90D', callback_data: buildCallback('range', stateId, '90d') },
      ],
    ],
  };
}
