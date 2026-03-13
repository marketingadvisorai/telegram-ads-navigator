#!/usr/bin/env bash
set -euo pipefail
cd /opt/openclaw/workspace/telegram-ads-navigator
export TELEGRAM_BOT_TOKEN='8766051574:AAHsuxajokHx6V9PwBjK45ZU309PaU6ZgxM'
while true; do
  node src/index.js >> /tmp/marketingadvisorai-bot.log 2>&1 || true
  echo "[restart] $(date -u +%FT%TZ)" >> /tmp/marketingadvisorai-bot.log
  sleep 2
done
