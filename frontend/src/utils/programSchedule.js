const fields = ['applicationStart', 'applicationDeadline', 'evaluationStart', 'evaluationDeadline'];
const labels = ['지원 시작', '지원 마감', '평가 시작', '평가 마감'];

// Both client timestamps share the same clock, so the device's offset cancels out.
export function scheduleNow(schedule, receivedAt, clientNow) {
  const serverNow = Date.parse(schedule?.serverNow);
  return Number.isFinite(serverNow) && receivedAt > 0
    ? serverNow + Math.max(0, clientNow - receivedAt) : clientNow;
}
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function scheduleInput(instant) {
  if (!instant || !Number.isFinite(Date.parse(instant))) return '';
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function validScheduleInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{1,2})$/.exec(value || '');
  if (!match) return false;
  const [, y, m, d, h, minute] = match.map(Number);
  if (y < 1000 || h > 23 || minute > 59) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function scheduleIso(value) {
  if (!value) return null;
  if (!validScheduleInput(value)) throw new RangeError('날짜와 시·분을 올바르게 입력해주세요.');
  const [date, time] = value.split('T');
  return `${date}T${time.split(':').map((v) => v.padStart(2, '0')).join(':')}:00+09:00`;
}

export function scheduleInstant(program, field) {
  const precise = program?.schedule?.[`${field}At`];
  if (precise) return precise;
  const date = program?.[field];
  if (!date) return null;
  if (!field.endsWith('Deadline')) return `${date}T00:00:00+09:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T00:00:00+09:00`;
}

export function schedulePayload(values, originalProgram = null) {
  return Object.fromEntries(fields.map((field) => {
    const original = scheduleInstant(originalProgram, field);
    const value = values[field];
    return [`${field}At`, original && value === scheduleInput(original) ? original : scheduleIso(value)];
  }));
}

export function scheduleErrors(values, { required = false, original = null } = {}) {
  const errors = {};
  fields.forEach((field, index) => {
    if (required && !values[field]) errors[field] = `${labels[index]} 날짜와 시각을 입력해주세요.`;
    else if (!values[field] && scheduleInstant(original, field)) errors[field] = '기존에 저장된 날짜와 시각은 비울 수 없습니다.';
    else if (values[field] && !validScheduleInput(values[field])) errors[field] = '날짜와 시·분을 올바르게 입력해주세요.';
  });
  if (Object.keys(errors).length) return errors;
  if (original?.id && fields.every((field) => (values[field] || '') === scheduleInput(scheduleInstant(original, field)))) return errors;
  const payload = schedulePayload(values, original);
  const times = fields.map((field) => payload[`${field}At`] ? Date.parse(payload[`${field}At`]) : null);
  if (times[0] !== null && times[1] !== null && times[0] >= times[1]) errors.applicationDeadline = '지원 마감은 지원 시작보다 늦어야 합니다.';
  if (times[1] !== null && times[2] !== null && times[2] < times[1]) errors.evaluationStart = '평가 시작은 지원 마감과 같거나 늦어야 합니다.';
  if (times[2] !== null && times[3] !== null && times[2] >= times[3]) errors.evaluationDeadline = '평가 마감은 평가 시작보다 늦어야 합니다.';
  return errors;
}

export function formatScheduleTime(instant) {
  const local = scheduleInput(instant);
  return local ? local.replaceAll('-', '.').replace('T', ' ') : '';
}

export function formatProgramPeriod(program, kind) {
  const start = formatScheduleTime(scheduleInstant(program, `${kind}Start`));
  const end = formatScheduleTime(scheduleInstant(program, `${kind}Deadline`));
  if (start && end) return `${start} ~ ${end}`;
  return start ? `${start}부터` : end ? `~ ${end}` : '미설정';
}

export function nextProgramDeadline(program, now = Date.now()) {
  const times = ['applicationDeadline', 'evaluationDeadline'].map((field) => Date.parse(scheduleInstant(program, field))).filter(Number.isFinite);
  const upcoming = times.filter((time) => time > now);
  return upcoming.length ? Math.min(...upcoming) : times.length ? Math.min(...times) : Infinity;
}

export function matchesDeadlineMonth(program, filter, now = new Date()) {
  if (filter === 'ALL') return true;
  const deadline = scheduleInstant(program, 'applicationDeadline');
  if (!deadline) return false;
  const localMonth = scheduleInput(now.toISOString()).slice(0, 7);
  const [year, month] = localMonth.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + (filter === 'THIS_MONTH' ? 1 : 2), 1)).toISOString().slice(0, 10);
  const instant = Date.parse(deadline);
  return instant >= Date.parse(`${localMonth}-01T00:00:00+09:00`) && instant < Date.parse(`${end}T00:00:00+09:00`);
}
