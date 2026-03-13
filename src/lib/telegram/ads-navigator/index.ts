import { listAdsNavigatorAccounts, getCampaignList, getAlerts } from './service';
import { createState, loadState, saveState } from './state-store';
import { parseCallback } from './callbacks';
import { renderState } from './router';
import { getAdsNavigatorConfig, isTelegramUserAllowed } from './config';
import type { AdsNavigatorViewState, TelegramMessagePayload, TelegramUpdate } from './types';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return token;
}

async function telegram(method: string, body: Record<string, unknown>) {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => null);
}

async function sendScreen(chatId: number, payload: TelegramMessagePayload) {
  const result = await telegram('sendMessage', {
    chat_id: chatId,
    text: payload.text,
    reply_markup: payload.reply_markup,
    parse_mode: payload.parse_mode || 'HTML',
    disable_web_page_preview: true,
  });
  return result?.result;
}

async function editScreen(chatId: number, messageId: number, payload: TelegramMessagePayload) {
  await telegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: payload.text,
    reply_markup: payload.reply_markup,
    parse_mode: payload.parse_mode || 'HTML',
    disable_web_page_preview: true,
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await telegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

function commandRequested(text?: string): boolean {
  const normalized = (text || '').trim().toLowerCase();
  return getAdsNavigatorConfig().commandAliases.some((alias) => normalized.startsWith(alias));
}

function pickWorkspaceArg(text?: string): string | null {
  const parts = (text || '').trim().split(/\s+/);
  return parts[1] || null;
}

export async function handleTelegramAdsNavigatorUpdate(update: TelegramUpdate): Promise<{ handled: boolean }> {
  const config = getAdsNavigatorConfig();
  if (!config.enabled) return { handled: false };

  if (update.message?.text && commandRequested(update.message.text)) {
    const userId = update.message.from?.id;
    if (!isTelegramUserAllowed(userId)) {
      return { handled: true };
    }

    const accounts = await listAdsNavigatorAccounts();
    if (!accounts.length) {
      await sendScreen(update.message.chat.id, {
        text: 'Ads Navigator is enabled, but no connected Google Ads or Meta Ads workspaces were found.',
        reply_markup: { inline_keyboard: [] },
        parse_mode: 'HTML',
      });
      return { handled: true };
    }

    const requested = pickWorkspaceArg(update.message.text);
    const matched = requested
      ? accounts.find((item) => item.workspaceName.toLowerCase().includes(requested.toLowerCase()) || item.label.toLowerCase().includes(requested.toLowerCase()))
      : accounts.length === 1
        ? accounts[0]
        : null;

    const initialState: AdsNavigatorViewState = matched
      ? {
          version: 1,
          screen: 'account',
          platform: 'hybrid',
          workspaceId: matched.workspaceId,
          dateRange: 'LAST_30_DAYS',
          page: 1,
          pageSize: 5,
          sort: 'spend_desc',
          filter: 'active',
          chatId: update.message.chat.id,
        }
      : {
          version: 1,
          screen: 'account_picker',
          platform: 'hybrid',
          dateRange: 'LAST_30_DAYS',
          page: 1,
          pageSize: 5,
          sort: 'spend_desc',
          filter: 'active',
          chatId: update.message.chat.id,
          accountPicker: accounts.map((item) => ({ workspaceId: item.workspaceId, label: item.label })),
        };

    const sent = await sendScreen(update.message.chat.id, { text: 'Loading Ads Navigator...', reply_markup: { inline_keyboard: [] }, parse_mode: 'HTML' });
    initialState.messageId = sent.message_id;
    const { stateId } = await createState(initialState);
    const payload = await renderState(stateId, initialState);
    await editScreen(update.message.chat.id, sent.message_id, payload);
    await saveState(stateId, initialState);
    return { handled: true };
  }

  if (update.callback_query?.data && update.callback_query.message) {
    const userId = update.callback_query.from.id;
    if (!isTelegramUserAllowed(userId)) {
      await answerCallbackQuery(update.callback_query.id, 'Not allowed');
      return { handled: true };
    }

    const parsed = parseCallback(update.callback_query.data);
    if (!parsed) return { handled: false };

    const message = update.callback_query.message;
    const state = await loadState(message.chat.id, message.message_id, parsed.stateId);
    if (!state) {
      await answerCallbackQuery(update.callback_query.id, 'This navigator session expired. Use /adsnav again.');
      return { handled: true };
    }

    let nextState: AdsNavigatorViewState = { ...state, messageId: message.message_id, chatId: message.chat.id };

    switch (parsed.action) {
      case 'pick': {
        const index = Number(parsed.arg.replace('a', '')) - 1;
        const picked = state.accountPicker?.[index];
        if (!picked) break;
        nextState = {
          ...nextState,
          workspaceId: picked.workspaceId,
          screen: 'account',
          parent: { screen: 'account_picker', page: 1 },
        };
        break;
      }
      case 'open': {
        if (parsed.arg === 'camp') nextState = { ...nextState, screen: 'campaigns', page: 1, parent: { screen: 'account', page: 1 } };
        if (parsed.arg === 'acct') nextState = { ...nextState, screen: 'account', page: 1 };
        if (parsed.arg === 'st') nextState = { ...nextState, screen: 'search_terms', page: 1, filter: 'all', parent: { screen: 'campaign', page: 1 } };
        if (parsed.arg === 'meta') nextState = { ...nextState, screen: 'meta_overview', page: 1, parent: { screen: 'account', page: 1 } };
        break;
      }
      case 'alert':
        nextState = { ...nextState, screen: 'alerts', page: 1, filter: 'all', parent: { screen: 'account', page: 1 } };
        break;
      case 'meta':
        nextState = { ...nextState, screen: 'meta_overview', page: 1, parent: { screen: 'account', page: 1 } };
        break;
      case 'conv':
        nextState = { ...nextState, screen: 'conversions', page: 1, filter: 'all', parent: { screen: nextState.screen, page: nextState.page } };
        break;
      case 'camp': {
        const index = Number(parsed.arg.replace('i', '')) - 1;
        const list = await getCampaignList(state.workspaceId!, state.dateRange, state.filter, state.sort, state.page, state.pageSize);
        const item = list.items[index];
        if (!item) break;
        nextState = {
          ...nextState,
          screen: 'campaign',
          campaignId: item.campaignId,
          campaignIndex: index,
          parent: { screen: 'campaigns', page: state.page, filter: state.filter, sort: state.sort },
        };
        break;
      }
      case 'campnav': {
        const list = await getCampaignList(state.workspaceId!, state.dateRange, 'all', 'spend_desc', 1, 100);
        const currentIndex = list.rankedCampaignIds.indexOf(state.campaignId || '');
        const offset = parsed.arg === 'prev' ? -1 : 1;
        const nextCampaignId = list.rankedCampaignIds[currentIndex + offset];
        if (nextCampaignId) nextState = { ...nextState, campaignId: nextCampaignId };
        break;
      }
      case 'page':
        nextState = { ...nextState, page: parsed.arg.startsWith('n') ? state.page + 1 : Math.max(1, state.page - 1) };
        break;
      case 'filter':
        nextState = { ...nextState, filter: parsed.arg === 'act' ? 'active' : (parsed.arg as any), page: 1 };
        break;
      case 'sort':
        nextState = { ...nextState, sort: parsed.arg === 'cpa' ? 'cpa_desc' : 'spend_desc', page: 1 };
        break;
      case 'range':
        nextState = { ...nextState, dateRange: parsed.arg === '7d' ? 'LAST_7_DAYS' : parsed.arg === '90d' ? 'LAST_90_DAYS' : 'LAST_30_DAYS', page: 1 };
        break;
      case 'back': {
        const parentScreen = state.parent?.screen || 'account';
        nextState = {
          ...nextState,
          screen: parentScreen,
          page: state.parent?.page || 1,
          filter: state.parent?.filter || 'active',
          sort: state.parent?.sort || 'spend_desc',
        };
        break;
      }
      case 'alertgo': {
        if (parsed.arg === 'meta') {
          nextState = { ...nextState, screen: 'meta_overview', parent: { screen: 'alerts', page: 1 } };
          break;
        }
        const alerts = await getAlerts(state.workspaceId!, state.dateRange, state.filter);
        const target = alerts.items.find((item) => item.cta === 'open_campaign');
        if (target) {
          nextState = { ...nextState, screen: 'campaign', campaignId: target.entityId, parent: { screen: 'alerts', page: 1 } };
        }
        break;
      }
      case 'refresh':
      default:
        break;
    }

    const payload = await renderState(parsed.stateId, nextState);
    await editScreen(message.chat.id, message.message_id, payload);
    await saveState(parsed.stateId, nextState);
    await answerCallbackQuery(update.callback_query.id);
    return { handled: true };
  }

  return { handled: false };
}
