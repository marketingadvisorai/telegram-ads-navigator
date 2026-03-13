import { z } from 'zod';
import type { AdsNavigatorDateRange, AdsNavigatorDateToken } from './types';

export const callbackActionSchema = z.enum([
  'open',
  'page',
  'camp',
  'term',
  'conv',
  'meta',
  'alert',
  'back',
  'refresh',
  'filter',
  'sort',
  'range',
  'pick',
  'campnav',
  'alertgo',
]);
export type CallbackAction = z.infer<typeof callbackActionSchema>;

export interface ParsedCallback {
  namespace: 'an';
  version: 'v1';
  action: CallbackAction | string;
  stateId: string;
  arg: string;
}

export function buildCallback(action: string, stateId: string, arg = 'x'): string {
  return `an:v1:${action}:${stateId}:${arg}`;
}

export function parseCallback(data?: string | null): ParsedCallback | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts.length < 5) return null;
  const [namespace, version, action, stateId, ...rest] = parts;
  if (namespace !== 'an' || version !== 'v1' || !action || !stateId) return null;
  return {
    namespace: 'an',
    version: 'v1',
    action,
    stateId,
    arg: rest.join(':') || 'x',
  };
}

export function dateTokenToRange(token: AdsNavigatorDateToken): AdsNavigatorDateRange {
  switch (token) {
    case '7d':
      return 'LAST_7_DAYS';
    case '90d':
      return 'LAST_90_DAYS';
    case '30d':
    default:
      return 'LAST_30_DAYS';
  }
}

export function rangeToDateToken(range: AdsNavigatorDateRange): AdsNavigatorDateToken {
  switch (range) {
    case 'LAST_7_DAYS':
      return '7d';
    case 'LAST_90_DAYS':
      return '90d';
    case 'LAST_30_DAYS':
    default:
      return '30d';
  }
}
