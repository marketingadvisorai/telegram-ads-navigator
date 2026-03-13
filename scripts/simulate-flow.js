import { handleCallback, openAds, resetSessions } from '../src/navigator.js';

resetSessions();

const chatId = 5351778248;

function printStep(title, screen) {
  console.log(`\n=== ${title} ===`);
  console.log(screen.text);
  console.log(JSON.stringify(screen.reply_markup));
}

const picker = await openAds(chatId);
printStep('/ads account picker', picker);

const summary = await handleCallback(chatId, 'pick:google:2910561991');
printStep('account summary', summary);

const campaignList = await handleCallback(chatId, 'screen:campaigns:google:2910561991');
printStep('campaign list', campaignList);

const campaignDetail = await handleCallback(chatId, 'camp:google:2910561991:23057434238');
printStep('campaign detail', campaignDetail);
