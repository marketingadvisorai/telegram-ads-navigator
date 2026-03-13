import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCallback, openAds, resetSessions, getActionType } from '../src/navigator.js';
import { createProgressScreen } from '../src/progress.js';

test('working read only flow renders google screens', async () => {
  resetSessions();
  const chatId = 1;

  const picker = await openAds(chatId);
  assert.match(picker.text, /Choose an account/i);

  const summary = await handleCallback(chatId, 'pick:2910561991');
  assert.match(summary.text, /ScreamWorks/i);
  assert.match(summary.text, /Google Ads/i);
  assert.match(summary.text, /Spend:/);

  const campaigns = await handleCallback(chatId, 'screen:campaigns:2910561991');
  assert.match(campaigns.text, /campaigns/i);
  assert.match(campaigns.text, /Search \| Escape Rooms \| MOF/);

  const detail = await handleCallback(chatId, 'camp:2910561991:23057434238');
  assert.match(detail.text, /Search \| Escape Rooms \| MOF/);
  assert.match(detail.text, /Daily budget:/);

  const terms = await handleCallback(chatId, 'terms:2910561991:23057434238');
  assert.match(terms.text, /Search terms/i);

  const conversions = await handleCallback(chatId, 'convs:2910561991');
  assert.match(conversions.text, /Conversion actions/i);

  const alerts = await handleCallback(chatId, 'alerts:2910561991');
  assert.match(alerts.text, /Alerts/i);
});

test('working read only flow renders meta screens', async () => {
  resetSessions();
  const chatId = 2;

  const picker = await openAds(chatId, 'meta');
  assert.match(picker.text, /Meta Ads Navigator/i);

  const summary = await handleCallback(chatId, 'pick:meta:1042551150662411');
  assert.match(summary.text, /ScreamWorks/i);
  assert.match(summary.text, /Meta Ads/i);

  const campaigns = await handleCallback(chatId, 'screen:campaigns:meta:1042551150662411');
  assert.match(campaigns.text, /campaigns/i);

  const firstCampaignButton = campaigns.reply_markup.inline_keyboard[0][0].callback_data;
  const detail = await handleCallback(chatId, firstCampaignButton);
  assert.match(detail.text, /Status:/i);

  const adSetsButton = detail.reply_markup.inline_keyboard[0][0].callback_data;
  const adsButton = detail.reply_markup.inline_keyboard[0][1].callback_data;

  const adSets = await handleCallback(chatId, adSetsButton);
  assert.match(adSets.text, /Meta ad sets/i);

  const ads = await handleCallback(chatId, adsButton);
  assert.match(ads.text, /Meta ads/i);
});

test('progress copy stays compact and meaningful', () => {
  const screen = createProgressScreen('campaigns', 1, 'screen:campaigns:google:2910561991');
  assert.match(screen.text, /Loading account context/);
  assert.match(screen.text, /Fetching campaign performance/);
  assert.match(screen.text, /Preparing campaign view/);
  assert.equal(getActionType('mads:meta:123:456'), 'mads');
  assert.equal(getActionType('terms:google:123:456'), 'terms');
});
