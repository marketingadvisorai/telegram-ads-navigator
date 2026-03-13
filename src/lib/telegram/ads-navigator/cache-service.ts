import { createHash } from 'crypto';

import { cacheDel, cacheGet, cacheSet } from '@/lib/cache/valkey-client';

import { assertReadOnlyOperation } from './read-only';

export const ADS_NAVIGATOR_TTLS = {
  accountSummary: 5 * 60,
  campaignList: 5 * 60,
  campaignDetail: 5 * 60,
  searchTerms: 10 * 60,
  conversionActions: 15 * 60,
  alerts: 5 * 60,
  metaOverview: 10 * 60,
} as const;

export type AdsNavigatorCacheType = keyof typeof ADS_NAVIGATOR_TTLS;

type CacheSource = 'cache' | 'live' | 'stale-cache';

interface CacheEnvelope<T> {
  value: T;
  storedAt: string;
  expiresAt: string;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function hashParts(parts: readonly string[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

export function buildAdsNavigatorCacheKey(parts: readonly string[]): string {
  return `adsnav:${hashParts(parts)}`;
}

function getMemoryEntry<T>(key: string): CacheEnvelope<T> | null {
  const entry = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  return entry ?? null;
}

async function getEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const cached = await cacheGet<CacheEnvelope<T>>(key);
  if (cached) return cached;
  return getMemoryEntry<T>(key);
}

async function setEnvelope<T>(key: string, envelope: CacheEnvelope<T>, ttlSeconds: number): Promise<void> {
  memoryCache.set(key, envelope);
  await cacheSet(key, envelope, ttlSeconds);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export interface ReadOnlyCacheResult<T> {
  value: T;
  source: CacheSource;
  fetchedAt: string;
  cacheAgeSeconds: number;
}

export async function readThroughCache<T>(options: {
  cacheType: AdsNavigatorCacheType;
  keyParts: readonly string[];
  forceRefresh?: boolean;
  fetcher: () => Promise<T>;
}): Promise<ReadOnlyCacheResult<T>> {
  assertReadOnlyOperation(`cache:${options.cacheType}:read`);

  const ttlSeconds = ADS_NAVIGATOR_TTLS[options.cacheType];
  const key = buildAdsNavigatorCacheKey(options.keyParts);
  const existing = await getEnvelope<T>(key);

  if (!options.forceRefresh && existing && !isExpired(existing.expiresAt)) {
    const age = Math.max(0, Math.floor((Date.now() - new Date(existing.storedAt).getTime()) / 1000));
    return {
      value: existing.value,
      source: 'cache',
      fetchedAt: existing.storedAt,
      cacheAgeSeconds: age,
    };
  }

  try {
    const freshValue = await options.fetcher();
    const storedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await setEnvelope(key, { value: freshValue, storedAt, expiresAt }, ttlSeconds);

    return {
      value: freshValue,
      source: 'live',
      fetchedAt: storedAt,
      cacheAgeSeconds: 0,
    };
  } catch (error) {
    if (existing) {
      const age = Math.max(0, Math.floor((Date.now() - new Date(existing.storedAt).getTime()) / 1000));
      return {
        value: existing.value,
        source: 'stale-cache',
        fetchedAt: existing.storedAt,
        cacheAgeSeconds: age,
      };
    }

    throw error;
  }
}

export async function clearAdsNavigatorCache(keyParts: readonly string[]): Promise<void> {
  const key = buildAdsNavigatorCacheKey(keyParts);
  memoryCache.delete(key);
  await cacheDel(key);
}

export function clearAdsNavigatorMemoryCache(): void {
  memoryCache.clear();
}
