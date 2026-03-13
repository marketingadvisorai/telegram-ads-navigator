import { handleCallback, openAds, resetSessions } from '../src/navigator.js';

resetSessions();

const chatId = 5351778248;

function printStep(title, screen) {
  console.log(`\n=== ${title} ===`);
  console.log(screen.text);
  console.log(JSON.stringify(screen.reply_markup));
}

const picker = openAds(chatId);
printStep('/ads account picker', picker);

const summary = handleCallback(chatId, 'pick:acc_1');
printStep('account summary', summary);

const campaignList = handleCallback(chatId, 'screen:campaigns:acc_1');
printStep('campaign list', campaignList);

const campaignDetail = handleCallback(chatId, 'camp:acc_1:camp_1');
printStep('campaign detail', campaignDetail);
