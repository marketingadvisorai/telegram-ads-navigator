import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCallback, openAds, resetSessions } from '../src/navigator.js';

test('working read only flow renders all target screens', () => {
  resetSessions();
  const chatId = 1;

  const picker = openAds(chatId);
  assert.match(picker.text, /Pick an account/);

  const summary = handleCallback(chatId, 'pick:acc_1');
  assert.match(summary.text, /ScreamWorks \| Google Ads/);
  assert.match(summary.text, /Spend:/);

  const list = handleCallback(chatId, 'screen:campaigns:acc_1');
  assert.match(list.text, /ScreamWorks \| Campaigns/);
  assert.match(list.text, /1\. Escape Rooms MOF/);

  const detail = handleCallback(chatId, 'camp:acc_1:camp_1');
  assert.match(detail.text, /Campaign \| Escape Rooms MOF/);
  assert.match(detail.text, /Daily budget:/);
});
