import { useId } from 'react';
import { validScheduleInput, scheduleErrors } from '../utils/programSchedule';

function ScheduleInput({ value, onChange, label, disabled, error }) {
  const id = useId();
  const [date = '', time = ''] = (value || '').split('T');
  const update = (nextDate, nextTime) => onChange(nextDate || nextTime ? `${nextDate}T${nextTime}` : '');
  return <div className="program-schedule-input-wrap">
    <div className="program-schedule-input" role="group" aria-label={label}
      aria-describedby={error ? `${id}-error` : undefined}>
      <input type="date" aria-label={`${label} 날짜`} value={date} disabled={disabled}
        aria-invalid={!!error} onInput={(e) => update(e.currentTarget.value, time)} onChange={(e) => update(e.target.value, time)} />
      <input type="text" inputMode="numeric" maxLength={5} placeholder="HH:mm"
        aria-label={`${label} 시각`} title="24시간제 HH:mm 형식" value={time} disabled={disabled}
        aria-invalid={!!error} onChange={(e) => update(date, e.target.value)}
        onBlur={() => {
          if (/^\d{1,2}:\d{1,2}$/.test(time)) {
            const normalized = time.split(':').map((part) => part.padStart(2, '0')).join(':');
            if (validScheduleInput(`${date}T${normalized}`)) update(date, normalized);
          }
        }} />
    </div>
    {error && <p id={`${id}-error`} className="program-field-error" role="alert">{error}</p>}
  </div>;
}

function deadlineDescription(value, evaluation = false) {
  if (!validScheduleInput(value)) return '마감 날짜와 시각을 입력하면 종료 시점을 확인할 수 있습니다.';
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const when = `${year}년 ${month}월 ${day}일 ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ''}`;
  return evaluation ? `${when}부터 평가 저장·제출이 제한됩니다.` : `${when}에 접수가 종료됩니다.`;
}

export default function ProgramScheduleSection({ values, onChange, errors, originalProgram, deadlineLocked }) {
  const complete = Object.values(values).every(validScheduleInput);
  const liveErrors = complete ? scheduleErrors(values, { original: originalProgram }) : {};
  return <section className="program-editor-group" aria-labelledby="program-schedule-heading">
    <div className="program-editor-heading-row"><h2 id="program-schedule-heading" className="program-editor-section-title">접수·평가 일정</h2><span>한국 시간(KST) 기준</span></div>
    <div className="program-editor-surface program-editor-periods">
      {[
        { title: '지원서 접수', prefix: '접수', start: 'applicationStart', end: 'applicationDeadline' },
        { title: '심사위원 평가', prefix: '평가', start: 'evaluationStart', end: 'evaluationDeadline' },
      ].map((period) => <section className="program-editor-period" key={period.start} aria-label={period.title}>
        <h3>{period.title}</h3><p className="program-editor-help">{period.description}</p>
        <div className="program-editor-period-fields">
          <div><div className="program-editor-input-label">{period.prefix} 시작<span className="program-editor-required">필수</span></div>
            <ScheduleInput value={values[period.start]} onChange={(value) => onChange(period.start, value)} label={`${period.prefix} 시작`} error={errors[period.start] || liveErrors[period.start]} /></div>
          <span className="program-editor-period-separator" aria-hidden="true">—</span>
          <div><div className="program-editor-input-label">{period.prefix} 마감<span className="program-editor-required">필수</span></div>
            <ScheduleInput value={values[period.end]} onChange={(value) => onChange(period.end, value)} label={`${period.prefix} 마감`} error={errors[period.end] || liveErrors[period.end]} disabled={period.end === 'applicationDeadline' && deadlineLocked} /></div>
        </div>
        {period.end === 'applicationDeadline' && deadlineLocked && <p className="program-editor-help">현재 운영 상태에서는 접수 마감 시각을 변경할 수 없습니다.</p>}
        <p className="program-editor-period-summary" role="status">{deadlineDescription(values[period.end], period.start === 'evaluationStart')}</p>
      </section>)}
      <p className="program-editor-help">평가 시작은 접수 마감과 같거나 늦어야 합니다.</p>
    </div>
  </section>;
}
