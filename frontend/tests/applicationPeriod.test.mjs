import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationPeriod, scheduleDaysUntil, scheduleDday, isApplicationDeadlineError,
  applicationDeadlineNotice } from '../src/utils/applicationPeriod.js';
import { scheduleNow } from '../src/utils/programSchedule.js';

const start = Date.parse('2030-11-20T09:00:00+09:00');
const end = Date.parse('2030-11-20T18:00:00+09:00');
const evaluationStart = Date.parse('2030-11-20T19:00:00+09:00');
const program = { schedule: { applicationStartAt: new Date(start).toISOString(),
  applicationDeadlineAt: new Date(end).toISOString(), evaluationStartAt: new Date(evaluationStart).toISOString(),
  periodStatus: 'SCHEDULED', canApply: false, canEditApplication: false } };

test('application editing opens at the inclusive start and closes at the exclusive deadline', () => {
  assert.equal(applicationPeriod(program, start - 1).applicationOpen, false);
  assert.equal(applicationPeriod(program, start).applicationOpen, true);
  assert.equal(applicationPeriod(program, end - 1).applicationOpen, true);
  assert.equal(applicationPeriod(program, end).applicationOpen, false);
  assert.equal(applicationPeriod(program, end + 1).applicationOpen, false);
});

test('frozen response availability flags do not prevent opening a scheduled program', () => {
  assert.equal(applicationPeriod(program, start).canApply, true);
  for (const periodStatus of ['DRAFT', 'INACTIVE']) {
    const inactive = { schedule: { ...program.schedule, periodStatus } };
    assert.equal(applicationPeriod(inactive, start).canApply, false);
  }
});

test('cancellation remains open after application deadline until the evaluation start instant', () => {
  assert.equal(applicationPeriod(program, end).canCancel, true);
  assert.equal(applicationPeriod(program, evaluationStart - 1).canCancel, true);
  assert.equal(applicationPeriod(program, evaluationStart).canCancel, false);
  assert.equal(applicationPeriod(program, evaluationStart + 1).canCancel, false);
});

test('server clock offset, elapsed time and a changed schedule determine live permissions', () => {
  const receivedAt = end + 9 * 3_600_000;
  const schedule = { ...program.schedule, serverNow: new Date(end - 1000).toISOString() };
  assert.equal(applicationPeriod({ schedule }, scheduleNow(schedule, receivedAt, receivedAt + 999)).applicationOpen, true);
  assert.equal(applicationPeriod({ schedule }, scheduleNow(schedule, receivedAt, receivedAt + 1000)).applicationOpen, false);
  assert.equal(applicationPeriod({ schedule: { ...schedule, applicationDeadlineAt: new Date(end + 1000).toISOString() } }, end).applicationOpen, true);
});

test('D-day uses Seoul calendar dates, but changes to closed at the precise time', () => {
  const deadline = '2030-11-21T00:30:00+09:00';
  assert.equal(scheduleDday(deadline, Date.parse('2030-11-20T23:59:00+09:00')), 'D-1');
  assert.equal(scheduleDday(deadline, Date.parse('2030-11-21T00:00:00+09:00')), 'D-DAY');
  assert.equal(scheduleDday(deadline, Date.parse(deadline)), '마감');
  assert.equal(scheduleDaysUntil(null, start), null);
});

test('missing data is locked, null bounds remain open, and legacy end dates are inclusive', () => {
  assert.equal(applicationPeriod(null, start).applicationOpen, false);
  assert.equal(applicationPeriod(null, start).canCancel, false);
  assert.equal(applicationPeriod({}, start).applicationOpen, true);
  const legacy = { applicationStart: '2030-11-20', applicationDeadline: '2030-11-20' };
  assert.equal(applicationPeriod(legacy, Date.parse('2030-11-20T23:59:59+09:00')).applicationOpen, true);
  assert.equal(applicationPeriod(legacy, Date.parse('2030-11-21T00:00:00+09:00')).applicationOpen, false);
});

test('only server deadline rejections lead to the home deadline notice', () => {
  const error = (message) => ({ response: { data: { message } } });
  assert.equal(isApplicationDeadlineError(error('지원 마감 시각이 지나 지원서를 수정할 수 없습니다.')), true);
  assert.equal(isApplicationDeadlineError(error('지원 시작 시각 이전에는 지원서를 수정할 수 없습니다.')), false);
  assert.equal(isApplicationDeadlineError(error('이름을 입력해주세요.')), false);
  assert.equal(isApplicationDeadlineError(new Error('network')), false);
  assert.match(applicationDeadlineNotice('제출'), /지원 마감 시간이 지났습니다.*제출 요청은 처리되지 않았습니다/);
  assert.match(applicationDeadlineNotice('수정'), /수정 요청은 처리되지 않았습니다/);
});
