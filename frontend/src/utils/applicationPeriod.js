import { scheduleInstant, scheduleInput } from './programSchedule.js';

export function isApplicationPeriodError(error) {
  return /지원 (시작|마감)/.test(error?.response?.data?.message || '');
}

export function isApplicationDeadlineError(error) {
  return /지원 마감/.test(error?.response?.data?.message || '');
}

export function applicationDeadlineNotice(operation = '제출·수정') {
  return `지원 마감 시간이 지났습니다. ${operation} 요청은 처리되지 않았습니다.`;
}

export function scheduleDaysUntil(instant, now) {
  const end = Date.parse(instant);
  if (!Number.isFinite(end)) return null;
  if (now >= end) return -1;
  const date = (value) => Date.parse(`${scheduleInput(value).slice(0, 10)}T00:00:00Z`);
  return Math.round((date(instant) - date(new Date(now).toISOString())) / 86_400_000);
}

export function scheduleDday(instant, now) {
  const days = scheduleDaysUntil(instant, now);
  return days === null ? null : days < 0 ? '마감' : days === 0 ? 'D-DAY' : `D-${days}`;
}

export function applicationPeriod(program, now) {
  const start = Date.parse(scheduleInstant(program, 'applicationStart'));
  const end = Date.parse(scheduleInstant(program, 'applicationDeadline'));
  const evaluationStart = Date.parse(scheduleInstant(program, 'evaluationStart'));
  const beforeStart = Number.isFinite(start) && now < start;
  const afterDeadline = Number.isFinite(end) && now >= end;
  const applicationOpen = !!program && !beforeStart && !afterDeadline;
  const canCancel = !!program && (!Number.isFinite(evaluationStart) || now < evaluationStart);
  const published = !['DRAFT', 'INACTIVE'].includes(program?.schedule?.periodStatus);
  const blockedMessage = !program ? '지원 기간을 확인할 수 없습니다. 다시 불러와주세요.'
    : beforeStart ? '지원 시작 전에는 저장·제출·수정·첨부 변경을 할 수 없습니다.'
      : afterDeadline ? '지원 마감 시각이 되어 저장·제출·수정·첨부 변경을 할 수 없습니다.' : '';
  return { beforeStart, afterDeadline, applicationOpen, canApply: applicationOpen && published, canCancel,
    blockedMessage, cancelMessage: canCancel ? '' : '평가가 시작되어 온라인으로 취소할 수 없습니다. 담당자에게 문의해주세요.',
    label: !program ? '기간 확인 중' : beforeStart ? '지원 시작 전' : afterDeadline ? '지원 마감' : '지원 접수 중',
    daysUntilDeadline: scheduleDaysUntil(scheduleInstant(program, 'applicationDeadline'), now),
    deadlineLabel: scheduleDday(scheduleInstant(program, 'applicationDeadline'), now),
    startLabel: scheduleDday(scheduleInstant(program, 'applicationStart'), now) };
}
