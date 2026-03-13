# Telegram Ads Navigator MVP

A tiny standalone Telegram bot that proves one real read only navigation flow inside this repo.

Working flow:
1. `/ads`
2. account picker
3. account summary
4. campaign list
5. campaign detail

## Why this version

The previous repo content was mostly docs plus source tied to a much larger Atmos app. It was not runnable here by itself. This MVP replaces that with the smallest practical local bot.

## Requirements

- Node.js 20+
- A Telegram bot token from BotFather

## Run locally

```bash
cd /opt/openclaw/workspace/telegram-ads-navigator
export TELEGRAM_BOT_TOKEN=your_bot_token_here
npm start
```

Then open your bot in Telegram and send:

```text
/ads
```

## Verify without Telegram

Run the local simulation:

```bash
npm run simulate
```

Run the test:

```bash
npm test
```

## Project structure

- `src/index.js` long polling Telegram bot
- `src/navigator.js` screen rendering and callback routing
- `src/data.js` sample read only ads data
- `scripts/simulate-flow.js` prints the working flow in terminal
- `test/flow.test.js` verifies the target MVP path

## What works

- `/ads` opens an account picker
- picking an account opens an account summary
- tapping `Campaigns` opens a campaign list
- tapping a numbered campaign opens a campaign detail screen
- all navigation is read only
- the bot edits the same message during callback navigation

## What does not work yet

- no real Google Ads or Meta API connection yet
- no persistence across process restarts
- no pagination beyond the first 5 campaigns
- no campaign next or previous navigation
- no search terms, conversions, alerts, or Meta overview
- no webhook mode, only long polling

## Notes

- Callback actions are intentionally simple and short.
- The data is currently static sample data so the flow is deterministic and easy to verify.
- This is meant to be the first working slice, not the whole system.
