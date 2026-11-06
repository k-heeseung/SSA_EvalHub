import test from 'node:test';
import assert from 'node:assert/strict';
import { validCriterionMaxScore, totalCriterionMaxScore } from '../src/utils/criteria.js';

test('criterion max accepts positive integer and two-decimal values within DB precision', () => {
  for (const value of ['0.01', '10', '40.25', '999999.99']) assert.equal(validCriterionMaxScore(value), true);
});
test('criterion max rejects missing, non-finite, non-positive, over-precision and overflow values', () => {
  for (const value of ['', null, undefined, 'NaN', 'Infinity', '-1', '0', '0.001', '40.251', '1000000', '1e2'])
    assert.equal(validCriterionMaxScore(value), false, String(value));
});
test('total max is independent of 100 points and avoids decimal artifacts', () => {
  assert.equal(totalCriterionMaxScore([{maxScore:'40'},{maxScore:'35'},{maxScore:'25'}]),100);
  assert.equal(totalCriterionMaxScore([{maxScore:'0.1'},{maxScore:'0.2'}]),0.3);
  assert.equal(totalCriterionMaxScore([{maxScore:'25'}]),25);
  assert.equal(totalCriterionMaxScore([]),0);
});
