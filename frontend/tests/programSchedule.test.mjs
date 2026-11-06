import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleInput, validScheduleInput, scheduleIso, scheduleInstant, schedulePayload,
  scheduleErrors, formatProgramPeriod, nextProgramDeadline, matchesDeadlineMonth } from '../src/utils/programSchedule.js';

const values = { applicationStart: '2030-11-10T09:00', applicationDeadline: '2030-11-20T18:00',
  evaluationStart: '2030-11-20T18:00', evaluationDeadline: '2030-11-30T18:00' };
const program = { id: 1, schedule: Object.fromEntries(Object.entries(values).map(([key, value]) => [`${key}At`, scheduleIso(value)])) };

test('calendar input and offset serialization are independent of browser timezone', () => {
  assert.equal(scheduleInput('2030-11-20T09:00:00Z'), '2030-11-20T18:00');
  assert.equal(scheduleInput('2030-11-20T15:00:00Z'), '2030-11-21T00:00');
  assert.equal(scheduleIso('2030-11-20T18:00'), '2030-11-20T18:00:00+09:00');
  assert.equal(scheduleIso('2030-11-20T9:5'), '2030-11-20T09:05:00+09:00');
});

test('invalid dates, incomplete times and out-of-range values are rejected', () => {
  for (const value of ['2030-02-29T12:00', '2030-11-31T12:00', '2030-13-01T12:00', '2030-11-20T24:00',
    '2030-11-20T18:60', '2030-11-20T18:', '2030-11-20T:00', 'T18:00']) {
    assert.equal(validScheduleInput(value), false, value);
    assert.throws(() => scheduleIso(value), RangeError);
  }
  assert.equal(validScheduleInput('2032-02-29T00:00'), true);
});

test('all four *At fields are sent without legacy date fields', () => {
  const payload = schedulePayload(values);
  assert.equal(payload.applicationDeadlineAt, '2030-11-20T18:00:00+09:00');
  assert.deepEqual(Object.keys(payload).sort(), Object.keys(program.schedule).sort());
  assert.deepEqual(scheduleErrors(values, { required: true }), {});
});

test('unchanged precise seconds are preserved, including partial editing', () => {
  const original = { id: 1, schedule: { ...program.schedule, applicationStartAt: '2030-11-10T09:00:45.123456+09:00' } };
  const payload = schedulePayload({ ...values, evaluationDeadline: '2030-12-01T12:30' }, original);
  assert.equal(payload.applicationStartAt, original.schedule.applicationStartAt);
  assert.equal(payload.evaluationDeadlineAt, '2030-12-01T12:30:00+09:00');
});

test('required, strict ordering, and equal cross-period boundary rules are enforced', () => {
  assert.equal(Object.keys(scheduleErrors({}, { required: true })).length, 4);
  assert.deepEqual(scheduleErrors({}), {});
  assert.ok(scheduleErrors({ ...values, applicationDeadline: values.applicationStart }).applicationDeadline);
  assert.ok(scheduleErrors({ ...values, evaluationStart: '2030-11-20T17:59' }).evaluationStart);
  assert.ok(scheduleErrors({ ...values, evaluationDeadline: values.evaluationStart }).evaluationDeadline);
  assert.deepEqual(scheduleErrors(values), {});
});

test('blanking an existing field is rejected because API null means preserve', () => {
  assert.ok(scheduleErrors({ ...values, applicationStart: '' }, { original: program }).applicationStart);
});

test('legacy inclusive date deadline is displayed as next day midnight', () => {
  const legacy = { applicationDeadline: '2030-11-20' };
  assert.equal(scheduleInstant(legacy, 'applicationDeadline'), '2030-11-21T00:00:00+09:00');
  assert.equal(formatProgramPeriod(legacy, 'application'), '~ 2030.11.21 00:00');
  assert.equal(formatProgramPeriod(program, 'application'), '2030.11.10 09:00 ~ 2030.11.20 18:00');
});

test('month filtering includes last-day evening and excludes next-month midnight', () => {
  const now = new Date('2030-11-04T00:00:00Z');
  const p = (end) => ({ schedule: { applicationDeadlineAt: end } });
  assert.equal(matchesDeadlineMonth(p('2030-11-30T23:59:00+09:00'), 'THIS_MONTH', now), true);
  assert.equal(matchesDeadlineMonth(p('2030-12-01T00:00:00+09:00'), 'THIS_MONTH', now), false);
  assert.equal(matchesDeadlineMonth(p('2030-10-31T23:59:00+09:00'), 'THIS_MONTH', now), false);
  assert.equal(matchesDeadlineMonth(p('2030-12-31T23:59:00+09:00'), 'NEXT_MONTH', now), true);
  assert.equal(matchesDeadlineMonth(p('2031-01-01T00:00:00+09:00'), 'NEXT_MONTH', now), false);
  assert.equal(matchesDeadlineMonth({}, 'THIS_MONTH', now), false);
});

test('month filtering uses Seoul month at UTC boundary and crosses years', () => {
  const p = { schedule: { applicationDeadlineAt: '2031-01-10T12:00:00+09:00' } };
  assert.equal(matchesDeadlineMonth(p, 'THIS_MONTH', new Date('2030-12-31T15:00:00Z')), true);
  assert.equal(matchesDeadlineMonth(p, 'NEXT_MONTH', new Date('2030-12-04T00:00:00Z')), true);
});

test('deadline ordering uses exact instants and skips a deadline at the current instant', () => {
  const end = Date.parse(program.schedule.applicationDeadlineAt);
  assert.equal(nextProgramDeadline(program, end - 1), end);
  assert.equal(nextProgramDeadline(program, end), Date.parse(program.schedule.evaluationDeadlineAt));
  assert.equal(nextProgramDeadline({}), Infinity);
});
