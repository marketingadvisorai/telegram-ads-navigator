export interface AdsNavigatorConfig {
  enabled: boolean;
  allowedUserIds: number[];
  commandAliases: string[];
}

function parseAllowedUserIds(raw?: string): number[] {
  return (raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

export function getAdsNavigatorConfig(): AdsNavigatorConfig {
  return {
    enabled: process.env.TELEGRAM_ADS_NAVIGATOR_ENABLED === 'true',
    allowedUserIds: parseAllowedUserIds(process.env.TELEGRAM_ADS_NAVIGATOR_ALLOWED_USER_IDS),
    commandAliases: ['/adsnav', '/ads'],
  };
}

export function isTelegramUserAllowed(userId?: number | null): boolean {
  const config = getAdsNavigatorConfig();
  if (!config.enabled || !userId) return false;
  if (config.allowedUserIds.length === 0) return false;
  return config.allowedUserIds.includes(userId);
}
