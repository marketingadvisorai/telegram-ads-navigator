import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCallback, openAds, resetSessions } from '../src/navigator.js';

test('working read only flow renders all target screens', () => {
  resetSessions();
  const chatId = 1;

  const picker = openAds(chatId);
  assert.match(picker.text, /Pick an account/);

  const summary = handleCallback(chatId, 'pick:2910561991');
  assert.match(summary.text, /ScreamWorks/);
  assert.match(summary.text, /Google Ads/);
  assert.match(summary.text, /Spend:/);

  const list = handleCallback(chatId, 'screen:campaigns:2910561991');
  assert.match(list.text, /ScreamWorks/);
  assert.match(list.text, /Campaigns/);
  assert.match(list.text, /Search \| Escape Rooms \| MOF/);

  const detail = handleCallback(chatId, 'camp:2910561991:23057434238');
  assert.match(detail.text, /Campaign \| Search \| Escape Rooms \| MOF/);
  assert.match(detail.text, /Daily budget:/);
});
