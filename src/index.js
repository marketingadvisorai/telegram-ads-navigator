import { handleCallback, openAds } from './navigator.js';
import { telegramApi } from './telegram-api.js';

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
  }, botToken);
}

async function editScreen(chatId, messageId, screen) {
  try {
    return await telegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: screen.text,
      reply_markup: screen.reply_markup,
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

async function handleUpdate(update) {
  if (update.message?.text?.trim() === '/ads') {
    const screen = openAds(update.message.chat.id);
    await sendScreen(update.message.chat.id, screen);
    return;
  }

  if (update.callback_query?.data) {
    const chatId = update.callback_query.message.chat.id;
    const messageId = update.callback_query.message.message_id;
    await answerCallbackQuery(update.callback_query.id);
    const screen = handleCallback(chatId, update.callback_query.data);
    await editScreen(chatId, messageId, screen);
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

console.log('Telegram Ads Navigator MVP is running. Send /ads to the bot.');
poll();
