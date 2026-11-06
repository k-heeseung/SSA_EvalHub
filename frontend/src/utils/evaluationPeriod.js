import { scheduleInstant } from './programSchedule.js';

export { scheduleNow } from './programSchedule.js';

export function evaluationPeriod(program, now) {
  const start = Date.parse(scheduleInstant(program, 'evaluationStart'));
  const end = Date.parse(scheduleInstant(program, 'evaluationDeadline'));
  const beforeStart = Number.isFinite(start) && now < start;
  const afterDeadline = Number.isFinite(end) && now >= end;
  return { beforeStart, afterDeadline, canEvaluate: !beforeStart && !afterDeadline,
    label: afterDeadline ? '심사 마감' : beforeStart ? '심사 시작 전' : '심사 진행 중' };
}
