import { callbackActionSchema, type CallbackAction } from './callbacks';

export const READ_ONLY_ACTIONS = new Set<CallbackAction>([
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

export function assertReadOnlyAction(action: string): asserts action is CallbackAction {
  const parsed = callbackActionSchema.safeParse(action);
  if (!parsed.success || !READ_ONLY_ACTIONS.has(parsed.data)) {
    throw new Error(`Blocked non read-only action: ${action}`);
  }
}

export function assertReadOnlyOperation(name: string, metadata?: Record<string, unknown>): void {
  const lowered = name.toLowerCase();
  const blockedPatterns = [
    'pause',
    'resume',
    'enable',
    'disable',
    'mutate',
    'create',
    'update',
    'delete',
    'remove',
    'negative',
    'budget',
    'bid',
    'write',
  ];

  if (blockedPatterns.some((pattern) => lowered.includes(pattern))) {
    const details = metadata ? ` ${JSON.stringify(metadata)}` : '';
    throw new Error(`Blocked write-capable navigator operation: ${name}${details}`);
  }
}
