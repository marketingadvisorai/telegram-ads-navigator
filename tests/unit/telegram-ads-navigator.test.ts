import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cache/valkey-client', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

import {
  CALLBACK_CONSTANTS,
  attachPaginationSnapshot,
  clearAdsNavigatorMemoryCache,
  clearNavigatorMemoryStateStore,
  createNavigatorState,
  encodeNavigatorCallback,
  getNavigatorState,
  parseNavigatorCallback,
  readThroughCache,
  replaceNavigatorState,
  assertReadOnlyAction,
  assertReadOnlyOperation,
} from '@/lib/telegram/ads-navigator';

describe('telegram ads navigator callbacks', () => {
  it('encodes and parses compact callback payloads', () => {
    const encoded = encodeNavigatorCallback({
      action: 'camp',
      stateId: 's8fd2a',
      arg: 'c123',
    });

    expect(encoded.length).toBeLessThanOrEqual(CALLBACK_CONSTANTS.MAX_CALLBACK_LENGTH);
    expect(parseNavigatorCallback(encoded)).toEqual({
      prefix: 'an',
      version: 'v1',
      action: 'camp',
      stateId: 's8fd2a',
      arg: 'c123',
    });
  });

  it('rejects invalid callback payloads', () => {
    expect(() => parseNavigatorCallback('bad:data')).toThrow();
    expect(() => encodeNavigatorCallback({ action: 'open', stateId: 'TOO-LONG', arg: 'acct' })).toThrow();
  });
});

describe('telegram ads navigator read-only guards', () => {
  it('allows safe navigator actions and blocks write-like operations', () => {
    expect(() => assertReadOnlyAction('refresh')).not.toThrow();
    expect(() => assertReadOnlyAction('delete')).toThrow();
    expect(() => assertReadOnlyOperation('campaign:pause')).toThrow();
    expect(() => assertReadOnlyOperation('campaign:read')).not.toThrow();
  });
});

describe('telegram ads navigator state store', () => {
  beforeEach(() => {
    clearNavigatorMemoryStateStore();
  });

  it('creates, loads, updates, and paginates a state snapshot', async () => {
    const { stateId } = await createNavigatorState({
      platform: 'google',
      screen: 'campaigns',
      accountId: '2910561991',
      campaignId: null,
      dateRange: 'LAST_30_DAYS',
      page: 1,
      pageSize: 2,
      sort: 'spend_desc',
      filter: 'active',
      messageId: 123,
      chatId: 5351778248,
      parent: { screen: 'account', page: 1 },
    });

    const loaded = await getNavigatorState({
      chatId: 5351778248,
      messageId: 123,
      stateId,
    });

    expect(loaded?.screen).toBe('campaigns');

    const updated = await replaceNavigatorState({
      chatId: 5351778248,
      messageId: 123,
      stateId,
      patch: { page: 2 },
    });

    const withPagination = attachPaginationSnapshot(updated, [
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ], (item) => item.id);

    expect(withPagination.pagination?.page).toBe(2);
    expect(withPagination.pagination?.visibleIds).toEqual(['c3']);
  });
});

describe('telegram ads navigator cache service', () => {
  beforeEach(() => {
    clearAdsNavigatorMemoryCache();
  });

  it('returns live data first, then cached data, then stale cache on failure', async () => {
    const keyParts = ['google', '2910561991', 'summary', '30d'] as const;
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: 1 });

    const live = await readThroughCache({
      cacheType: 'accountSummary',
      keyParts,
      fetcher,
    });

    expect(live.source).toBe('live');
    expect(live.value).toEqual({ ok: 1 });

    const cached = await readThroughCache({
      cacheType: 'accountSummary',
      keyParts,
      fetcher: vi.fn().mockResolvedValue({ ok: 2 }),
    });

    expect(cached.source).toBe('cache');
    expect(cached.value).toEqual({ ok: 1 });

    const stale = await readThroughCache({
      cacheType: 'accountSummary',
      keyParts,
      forceRefresh: true,
      fetcher: vi.fn().mockRejectedValue(new Error('network fail')),
    });

    expect(stale.source).toBe('stale-cache');
    expect(stale.value).toEqual({ ok: 1 });
  });
});
