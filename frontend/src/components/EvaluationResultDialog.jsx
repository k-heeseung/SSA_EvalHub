import { useEffect, useRef, useState } from 'react';
import { Button, TableScroll } from './ui';
import { RESULT_METHODS } from '../utils/resultScoring';
import { RESULT_STATUS } from '../utils/resultPresentation';

const fmt = value => value == null ? '—' : Number(value).toFixed(1);
const reviewerName = evaluation => evaluation.evaluatorName || evaluation.evaluatorEmail || '심사위원';
const submitted = evaluation => evaluation.submission?.status === 'SUBMITTED';
const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : null;

export default function EvaluationResultDialog({ team, method, hasBonus, criteriaQuery, pending, nextTeam, message, onClose, onSave, onOpenTeam }) {
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const value = draft ?? team.teamStatus;
  const dirty = value !== team.teamStatus;
  const evaluations = team.evaluations ?? [];
  const criteria = criteriaQuery.data ?? [];

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const leave = callback => {
    if (pending || savingRef.current) return;
    if (!dirty || window.confirm('저장하지 않은 판정이 있습니다. 변경을 버리고 이동할까요?')) callback();
  };
  const save = async advance => {
    if (pending || savingRef.current) return;
    savingRef.current = true;
    setError('');
    try {
      await onSave(value, advance);
      setDraft(null);
    } catch (err) {
      setError(err.response?.data?.message || '판정을 저장하지 못했습니다. 선택한 판정은 유지됩니다. 다시 시도해주세요.');
    } finally { savingRef.current = false; }
  };

  return <dialog ref={dialogRef} className="evaluation-result-dialog" aria-labelledby="evaluation-result-title"
    onCancel={event => { event.preventDefault(); leave(onClose); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) leave(onClose);
    } }}>
    <div className="evaluation-result-content">
      <header className="evaluation-result-heading">
        <div><h2 id="evaluation-result-title">{team.teamName}</h2><p>평가 상세 · {team.rank == null ? '순위 산출 대기' : `${team.rank}위`}</p></div>
        <Button variant="ghost" autoFocus disabled={pending} onClick={() => leave(onClose)}>닫기</Button>
      </header>
      <div className="evaluation-result-summary">
        <div><span>심사위원 평균</span><strong>{fmt(team.avg)}</strong></div>
        {hasBonus && <div><span>가산점 합계</span><strong>{fmt(team.bonus)}</strong></div>}
        <div className="evaluation-result-total"><span>총합</span><strong>{fmt(team.final)}</strong></div>
      </div>
      <p className="evaluation-result-basis">{RESULT_METHODS[method]} · 심사 {team.submittedCount} / {team.assignedCount}명 제출</p>
      {team.unavailableReason && <p className="program-results-warning">최종 점수 산출 불가: {team.unavailableReason}. 산출 불가 상태에서도 최종 판정은 저장할 수 있습니다.</p>}
      <section aria-labelledby="evaluation-result-scores"><h3 id="evaluation-result-scores">기준별 점수</h3>
        {criteriaQuery.isPending ? <p role="status">평가 기준을 불러오는 중입니다…</p> : criteriaQuery.isError ? <p role="alert">평가 기준을 불러오지 못했습니다. <Button onClick={() => criteriaQuery.refetch()}>다시 시도</Button></p> : !criteria.length ? <p>등록된 평가 기준이 없습니다.</p> : !evaluations.length ? <p>배정된 심사위원이 없습니다.</p> : <TableScroll>
          <table className="evaluation-result-scores"><thead><tr><th scope="col">평가 기준</th>{evaluations.map((evaluation, index) => <th scope="col" key={evaluation.evaluatorId}>{reviewerName(evaluation)}<small>{!submitted(evaluation) ? '미제출' : team.excludedIndices.includes(index) ? '평균 산출 제외' : '제출 완료'}</small></th>)}</tr></thead>
            <tbody>{criteria.map(criterion => <tr key={criterion.id}><th scope="row">{criterion.name}<small> / {Number(criterion.maxScore)}점</small></th>{evaluations.map(evaluation => <td key={evaluation.evaluatorId}>{submitted(evaluation) ? fmt(evaluation.submission.scores?.find(score => score.criterionId === criterion.id)?.score) : '미제출'}</td>)}</tr>)}
              <tr><th scope="row">총점</th>{evaluations.map((evaluation, index) => <td key={evaluation.evaluatorId} className={team.excludedIndices.includes(index) ? 'is-excluded' : ''}>{submitted(evaluation) ? fmt(evaluation.submission.totalScore) : '미제출'}</td>)}</tr>
            </tbody></table>
        </TableScroll>}
        {method === 'TRIMMED' && <p className="evaluation-result-hint">취소선은 평균 산출에서 제외된 총점입니다. 최고·최저 각 1건만 제외하며, 기준별 점수와 의견은 그대로 확인할 수 있습니다.</p>}
      </section>
      {hasBonus && <section aria-labelledby="evaluation-result-bonus"><h3 id="evaluation-result-bonus">가산점 항목</h3>
        <dl className="evaluation-result-bonus">{team.bonusScores?.length ? team.bonusScores.map(item => <div key={item.itemId}><dt>{item.name}</dt><dd>{fmt(item.score)}{item.maxScore != null && <span> / {Number(item.maxScore)}점</span>}</dd></div>) : <div><dt>가산점 합계</dt><dd>{fmt(team.bonusScore)}</dd></div>}</dl>
        {team.bonusScores?.some(item => item.score == null) && <p className="evaluation-result-hint">미입력 항목은 ‘—’로 표시하며 총합에는 입력된 가산점만 반영됩니다.</p>}
      </section>}
      <section aria-labelledby="evaluation-result-comments"><h3 id="evaluation-result-comments">심사위원 의견</h3>
        {!evaluations.length && <p>배정된 심사위원이 없습니다.</p>}
        <div className="evaluation-result-comments">{evaluations.map(evaluation => <article key={evaluation.evaluatorId}><div><strong>{reviewerName(evaluation)}</strong><span>{submitted(evaluation) ? dateTime(evaluation.submission.submittedAt) || '제출 완료' : '미제출'}</span></div><p>{submitted(evaluation) ? evaluation.submission.oneLineComment?.trim() || '등록된 의견이 없습니다.' : '아직 심사가 제출되지 않았습니다.'}</p></article>)}</div>
      </section>
      <Button variant="ghost" className="evaluation-result-materials" disabled={pending} onClick={() => leave(onOpenTeam)}>지원서 · 첨부 자료 · 팀 정보 보기</Button>
      <footer className="evaluation-result-verdict">
        <fieldset disabled={pending}><legend>최종 판정</legend><p>지원자에게는 노출되지 않습니다.</p><div className="evaluation-result-options">{Object.entries(RESULT_STATUS).map(([key, info]) => <label key={key}><input type="radio" name="finalVerdict" value={key} checked={value === key} onChange={() => { setDraft(key); setError(''); }} />{info.label}</label>)}</div></fieldset>
        {error && <p className="evaluation-result-error" role="alert">{error}</p>}
        <p className="program-results-feedback" role="status" aria-live="polite">{pending ? '판정을 저장하고 있습니다…' : message}</p>
        <div className="evaluation-result-save"><Button disabled={!dirty || pending} onClick={() => setDraft(null)}>변경 취소</Button><Button disabled={!dirty || pending} onClick={() => save(false)}>판정 저장</Button><Button variant="primary" disabled={!nextTeam || pending} onClick={() => save(true)}>저장 후 다음</Button></div>
        {!nextTeam && <p className="evaluation-result-hint">현재 목록의 마지막 팀입니다.</p>}
      </footer>
    </div>
  </dialog>;
}
