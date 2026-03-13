const TELEGRAM_API_BASE = 'https://api.telegram.org';

export async function telegramApi(method, body, token) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Telegram API error for ${method}: ${JSON.stringify(json)}`);
  }
  return json.result;
}
