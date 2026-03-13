import { handleCallback, openAds, getActionType } from './navigator.js';
import { telegramApi } from './telegram-api.js';
import { createProgressScreen, runProgressSteps } from './progress.js';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

let offset = 0;

async function sendScreen(chatId, screen) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text: screen.text,
    reply_markup: screen.reply_markup,
    parse_mode: screen.parse_mode,
  }, botToken);
}

async function editScreen(chatId, messageId, screen) {
  try {
    return await telegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: screen.text,
      reply_markup: screen.reply_markup,
      parse_mode: screen.parse_mode,
    }, botToken);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('message is not modified')) {
      return null;
    }
    throw error;
  }
}

async function answerCallbackQuery(callbackQueryId) {
  try {
    return await telegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId }, botToken);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('query is too old') || message.includes('query ID is invalid')) {
      return null;
    }
    throw error;
  }
}

function buildFriendlyErrorScreen() {
  return {
    text: [
      '⚠️ Could not load this view',
      '',
      'The data source took too long or replied unexpectedly.',
      'Nothing changed in the ad account.',
      '',
      'Please try refresh in a moment.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [[{ text: '🏠 Home', callback_data: 'screen:picker' }]],
    },
  };
}

async function handleOpenCommand(chatId, filter) {
  const loadingMessage = await sendScreen(chatId, createProgressScreen('open', 0, 'noop'));
  try {
    await runProgressSteps({
      action: 'open',
      callbackData: 'noop',
      onUpdate: (screen) => editScreen(chatId, loadingMessage.message_id, screen),
    });
    const screen = await openAds(chatId, filter);
    await editScreen(chatId, loadingMessage.message_id, screen);
  } catch (error) {
    console.error(error);
    await editScreen(chatId, loadingMessage.message_id, buildFriendlyErrorScreen());
  }
}

async function handleUpdate(update) {
  const text = update.message?.text?.trim();
  if (text === '/ads') {
    await handleOpenCommand(update.message.chat.id, 'all');
    return;
  }
  if (text === '/gads') {
    await handleOpenCommand(update.message.chat.id, 'google');
    return;
  }
  if (text === '/metaads') {
    await handleOpenCommand(update.message.chat.id, 'meta');
    return;
  }

  if (update.callback_query?.data) {
    const chatId = update.callback_query.message.chat.id;
    const messageId = update.callback_query.message.message_id;
    const callbackData = update.callback_query.data;
    await answerCallbackQuery(update.callback_query.id);

    try {
      await runProgressSteps({
        action: getActionType(callbackData),
        callbackData,
        onUpdate: (screen) => editScreen(chatId, messageId, screen),
      });
      const screen = await handleCallback(chatId, callbackData);
      await editScreen(chatId, messageId, screen);
    } catch (error) {
      console.error(error);
      await editScreen(chatId, messageId, buildFriendlyErrorScreen());
    }
  }
}

async function poll() {
  while (true) {
    try {
      const updates = await telegramApi('getUpdates', { offset, timeout: 30 }, botToken);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

console.log('Telegram Ads Navigator MVP is running. Send /ads, /gads, or /metaads to the bot.');
poll();
