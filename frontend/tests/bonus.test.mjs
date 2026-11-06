import test from 'node:test';
import assert from 'node:assert/strict';
import { bonusSummary, validBonusScore } from '../src/utils/bonus.js';

test('missing scores remain distinct from scored zero', () => {
  assert.deepEqual(bonusSummary([{ score: null }, { score: null }]), { total: null, completed: 0, count: 2 });
  assert.deepEqual(bonusSummary([{ score: 0 }, { score: null }]), { total: 0, completed: 1, count: 2 });
});
test('each item contributes once and decimal totals are stable', () => {
  assert.deepEqual(bonusSummary([{ score: 0.1 }, { score: 0.2 }, { score: null }]), { total: 0.3, completed: 2, count: 3 });
});
test('score bounds and precision match server validation', () => {
  for (const value of ['', '0', '2', '1.25']) assert.equal(validBonusScore(value, 2), true);
  for (const value of ['-1', '2.01', 'NaN', 'Infinity', '0.001']) assert.equal(validBonusScore(value, 2), false);
  assert.equal(validBonusScore('7', null), true);
});
