import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCallback, openAds, resetSessions, getActionType } from '../src/navigator.js';
import { createProgressScreen } from '../src/progress.js';

test('working read only flow renders all target screens', async () => {
  resetSessions();
  const chatId = 1;

  const picker = await openAds(chatId);
  assert.match(picker.text, /Choose an account/);

  const summary = await handleCallback(chatId, 'pick:google:2910561991');
  assert.match(summary.text, /ScreamWorks/);
  assert.match(summary.text, /Google Ads/);
  assert.match(summary.text, /Spend:/);

  const list = await handleCallback(chatId, 'screen:campaigns:google:2910561991');
  assert.match(list.text, /ScreamWorks/);
  assert.match(list.text, /campaigns/i);
  assert.match(list.text, /Search \| Escape Rooms \| MOF/);

  const detail = await handleCallback(chatId, 'camp:google:2910561991:23057434238');
  assert.match(detail.text, /Search \| Escape Rooms \| MOF/);
  assert.match(detail.text, /Daily budget:/);
});

test('progress copy stays compact and meaningful', () => {
  const screen = createProgressScreen('campaigns', 1, 'screen:campaigns:google:2910561991');
  assert.match(screen.text, /Loading account context/);
  assert.match(screen.text, /Fetching campaign performance/);
  assert.match(screen.text, /Preparing campaign view/);
  assert.equal(getActionType('mads:meta:123:456'), 'mads');
  assert.equal(getActionType('terms:google:123:456'), 'terms');
});
