import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluationPeriod, scheduleNow } from '../src/utils/evaluationPeriod.js';

const start = Date.parse('2030-11-20T18:00:00+09:00');
const end = start + 60_000;
const program = { schedule: { evaluationStartAt: new Date(start).toISOString(), evaluationDeadlineAt: new Date(end).toISOString() } };

test('evaluation opens exactly at start and closes exactly at deadline', () => {
  assert.equal(evaluationPeriod(program, start - 1).beforeStart, true);
  assert.equal(evaluationPeriod(program, start).canEvaluate, true);
  assert.equal(evaluationPeriod(program, end - 1).canEvaluate, true);
  assert.equal(evaluationPeriod(program, end).afterDeadline, true);
  assert.equal(evaluationPeriod(program, end + 1).canEvaluate, false);
});

test('submitted evaluations have the same period restrictions', () => {
  const submitted = { ...program, submission: { status: 'SUBMITTED' } };
  assert.equal(evaluationPeriod(submitted, start - 1).canEvaluate, false);
  assert.equal(evaluationPeriod(submitted, end).canEvaluate, false);
});

test('server time cancels a client clock offset and advances between queries', () => {
  const receivedAt = start + 9 * 3_600_000;
  const schedule = { serverNow: new Date(start).toISOString() };
  assert.equal(scheduleNow(schedule, receivedAt, receivedAt), start);
  assert.equal(evaluationPeriod(program, scheduleNow(schedule, receivedAt, receivedAt + 60_000)).canEvaluate, false);
  const behind = start - 9 * 3_600_000;
  assert.equal(scheduleNow(schedule, behind, behind + 500), start + 500);
});

test('a fresh server response replaces the old clock and schedule', () => {
  const extended = { schedule: { ...program.schedule, evaluationDeadlineAt: new Date(end + 60_000).toISOString(), serverNow: new Date(end).toISOString() } };
  assert.equal(evaluationPeriod(program, end).canEvaluate, false);
  assert.equal(evaluationPeriod(extended, scheduleNow(extended.schedule, 100, 100)).canEvaluate, true);
});

test('legacy dates retain next-day exclusive deadlines and absent bounds remain open', () => {
  const legacy = { evaluationStart: '2030-11-20', evaluationDeadline: '2030-11-20' };
  assert.equal(evaluationPeriod(legacy, Date.parse('2030-11-20T23:59:59+09:00')).canEvaluate, true);
  assert.equal(evaluationPeriod(legacy, Date.parse('2030-11-21T00:00:00+09:00')).afterDeadline, true);
  assert.equal(evaluationPeriod({}, start).canEvaluate, true);
});
