import { nanoid } from 'nanoid';
import { cacheGet, cacheSet } from '@/lib/cache/valkey-client';
import type { AdsNavigatorViewState } from './types';

const TTL_SECONDS = 30 * 60;
const KEY_PREFIX = 'tg_nav';

function key(chatId: number, messageId: number, stateId: string): string {
  return `${KEY_PREFIX}:${chatId}:${messageId}:${stateId}`;
}

export async function createState(state: AdsNavigatorViewState): Promise<{ stateId: string; state: AdsNavigatorViewState }> {
  const stateId = nanoid(8);
  if (state.messageId) {
    await cacheSet(key(state.chatId, state.messageId, stateId), state, TTL_SECONDS);
  }
  return { stateId, state };
}

export async function saveState(stateId: string, state: AdsNavigatorViewState): Promise<void> {
  if (!state.messageId) return;
  await cacheSet(key(state.chatId, state.messageId, stateId), state, TTL_SECONDS);
}

export async function loadState(chatId: number, messageId: number, stateId: string): Promise<AdsNavigatorViewState | null> {
  return cacheGet<AdsNavigatorViewState>(key(chatId, messageId, stateId));
}
