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
  return telegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: screen.text,
    reply_markup: screen.reply_markup,
  }, botToken);
}

async function answerCallbackQuery(callbackQueryId) {
  return telegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId }, botToken);
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
    const screen = handleCallback(chatId, update.callback_query.data);
    await editScreen(chatId, messageId, screen);
    await answerCallbackQuery(update.callback_query.id);
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
