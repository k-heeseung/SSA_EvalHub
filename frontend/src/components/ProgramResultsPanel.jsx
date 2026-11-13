import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TableScroll } from './ui';
import { changeTeamStatus, getCriteria, getEvaluationResults, getEvaluationResultsPdf } from '../api/programs';
import { rankedTeams, exportAllTeamsExcel, exportFinalExcel } from '../utils/export';
import { downloadPdfResponse } from '../utils/pdfDownload';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { RESULT_METHODS } from '../utils/resultScoring';
import { RESULT_STATUS } from '../utils/resultPresentation';
import EvaluationResultDialog from './EvaluationResultDialog';
import ProgramResultsExports from './ProgramResultsExports';
import './ProgramResultsPanel.css';

const FILTERS = [{ key: 'ALL', label: '전체' }, ...['PASSED', 'FAILED', 'PENDING'].map(key => ({ key, label: RESULT_STATUS[key].label }))];
const fmt = (value) => value == null ? '—' : Number(value).toFixed(1);

export default function ProgramResultsPanel({ programId, program }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(item => item.key === params.get('resultFilter')) ? params.get('resultFilter') : 'ALL';
  const method = Object.hasOwn(RESULT_METHODS, params.get('resultMethod')) ? params.get('resultMethod') : 'ALL';
  const selectedId = params.get('resultTeam');
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState('');
  const [message, setMessage] = useState('');
  const resultsQuery = useLiveApiQuery(queryKeys.evaluationResults(programId), () => getEvaluationResults(programId));
  const criteriaQuery = useLiveApiQuery(queryKeys.criteria(programId), () => getCriteria(programId));
  const results = resultsQuery.data ?? [];
  const ranked = rankedTeams(results, method);
  const filtered = filter === 'ALL' ? ranked : ranked.filter(team => team.teamStatus === filter);
  const selected = ranked.find(team => String(team.teamId) === selectedId);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rawPage = Number(params.get('resultPage'));
  const page = Math.min(Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1, pageCount);
  const offset = (page - 1) * pageSize;
  const pageTeams = filtered.slice(offset, offset + pageSize);
  const calculable = ranked.filter(team => team.final != null);
  const completed = ranked.filter(team => team.assignedCount > 0 && team.submittedCount === team.assignedCount).length;
  const average = calculable.length ? (calculable.reduce((sum, team) => sum + team.avg, 0) / calculable.length).toFixed(1) : '—';
  const buckets = [{ label:'<60', min:0, max:60 }, { label:'60', min:60, max:70 }, { label:'70', min:70, max:80 }, { label:'80', min:80, max:90 }, { label:'90+', min:90, max:Infinity }].map(bucket => ({ ...bucket, count:calculable.filter(team => team.final >= bucket.min && team.final < bucket.max).length }));
  const maxBucket = Math.max(1, ...buckets.map(bucket => bucket.count));
  const bonusColumns = new Map((program?.bonusItems ?? []).map(item => [item.id, { ...item, itemId: item.id }]));
  results.forEach(team => (team.bonusScores ?? []).forEach(item => {
    if (!bonusColumns.has(item.itemId)) bonusColumns.set(item.itemId, item);
  }));
  const bonusItems = [...bonusColumns.values()];
  const hasBonus = !!program?.bonusEnabled || bonusItems.length > 0 || results.some(team => team.bonusScore != null);
  const legacyBonus = hasBonus && bonusItems.length === 0;
  const statusMutation = useMutation({
    mutationFn: ({ teamId, status }) => changeTeamStatus(programId, teamId, { status }),
    meta: { skipInvalidation: true },
  });
  const updateParams = (values) => setParams((current) => {
    const next = new URLSearchParams(current);
    next.set('tab', 'results');
    Object.entries(values).forEach(([key, value]) => value == null ? next.delete(key) : next.set(key, String(value)));
    return next;
  }, { replace: true, state: location.state });
  const openTeam = (team) => { setMessage(''); updateParams({ resultTeam: team.teamId }); };
  const nextTeam = selected ? filtered[filtered.findIndex(team => team.teamId === selected.teamId) + 1] : null;
  const saveVerdict = async (status, advance) => {
    const savedTeam = selected;
    const following = nextTeam;
    if (status !== savedTeam.teamStatus) {
      const { data: updated } = await statusMutation.mutateAsync({ teamId: savedTeam.teamId, status });
      queryClient.setQueryData(queryKeys.evaluationResults(programId), (current = []) => current.map(team => (
        team.teamId === savedTeam.teamId ? { ...team, teamStatus: updated.status } : team
      )));
      queryClient.setQueryData(queryKeys.team(programId, savedTeam.teamId), updated);
      queryClient.setQueryData(queryKeys.teams(programId), (current) => current?.map(team => team.teamId === savedTeam.teamId ? updated : team));
      void queryClient.invalidateQueries({ queryKey: queryKeys.evaluationResults(programId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams(programId) });
    }
    if (advance && following) {
      const remaining = filtered.filter(team => team.teamId !== savedTeam.teamId || filter === 'ALL' || status === filter);
      const index = remaining.findIndex(team => team.teamId === following.teamId);
      updateParams({ resultTeam: following.teamId, resultPage: Math.floor(Math.max(index, 0) / pageSize) + 1 });
    }
  };
  const exportFile = async (format, passedOnly = false) => {
    if (exportPending) return;
    setExportError(''); setExportPending(true);
    try {
      const title = program?.title || '평가 결과';
      if (format === 'pdf') {
        const response = await getEvaluationResultsPdf(programId, passedOnly, method);
        await downloadPdfResponse(response, `${title}_${RESULT_METHODS[method]}_${passedOnly ? '최종합격' : '상세평가'}.pdf`);
      } else await (passedOnly ? exportFinalExcel : exportAllTeamsExcel)(title, results, method);
    } catch { setExportError('파일을 내보내지 못했습니다. 잠시 후 다시 시도해주세요.'); }
    finally { setExportPending(false); }
  };
  const goToTeamInfo = () => navigate(`/admin/programs/${programId}/teams/${selected.teamId}`, {
    state: { resultReturn: `${location.pathname}${location.search}`, resultMethod: method },
  });

  if (resultsQuery.isPending) return <p className="program-results-message" role="status">평가 결과를 불러오는 중입니다…</p>;
  if (resultsQuery.isError && !resultsQuery.data) return <div className="program-results-message" role="alert"><p>평가 결과를 불러오지 못했습니다.</p><Button onClick={() => resultsQuery.refetch()}>다시 시도</Button></div>;
  if (!results.length) return <p className="program-results-message">등록된 팀이 없습니다. 지원 팀 탭에서 팀을 확인해주세요.</p>;

  return <div className="program-results">
    <div className="program-results-method-row">
      <div className="program-results-method-control"><span>평균 산출 방식</span><div role="group" aria-label="평균 산출 방식">
        {Object.entries(RESULT_METHODS).map(([key,label]) => <button key={key} type="button" aria-pressed={method === key} disabled={exportPending} onClick={() => updateParams({ resultMethod:key, resultPage:1 })}>{label}</button>)}
      </div></div>
      {calculable.length < ranked.length && <span className="program-results-provisional">잠정 순위 · 산출 불가 {ranked.length - calculable.length}팀</span>}
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-2">
      {[{label:'심사 제출 완료',value:`${completed} / ${results.length}팀`},{label:'산출 가능',value:`${calculable.length}팀`},{label:'산출 불가',value:`${ranked.length-calculable.length}팀`},{label:'팀별 심사위원 평균',value:average}].map(item => <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500 mb-1">{item.label}</p><p className="text-2xl font-bold text-gray-900">{item.value}</p></div>)}
    </div>
    {resultsQuery.isError && <p role="alert" className="program-results-warning">최신 결과를 갱신하지 못했습니다. <Button onClick={() => resultsQuery.refetch()}>다시 시도</Button></p>}
    <p className="program-results-feedback" role="status" aria-live="polite">{message}</p>
    <div className="program-results-layout grid grid-cols-1 xl:grid-cols-3 gap-2">
    <section className="program-results-ranking xl:col-span-2" aria-label="전체 팀 평가 비교">
      <div className="program-results-ranking-heading"><span>최종 순위 <small>· {RESULT_METHODS[method]}</small></span>
      <div className="program-results-filters" role="group" aria-label="최종 판정 필터">
        {FILTERS.map(item => <Button key={item.key} variant="ghost" aria-pressed={filter === item.key}
          onClick={() => updateParams({ resultFilter: item.key, resultPage: 1 })}>
          {item.label} <span>{item.key === 'ALL' ? results.length : results.filter(team => team.teamStatus === item.key).length}</span>
        </Button>)}
      </div>
      </div>
      <TableScroll className="program-results-table-scroll">
        <table className="program-results-table">
          <thead><tr>
            <th scope="col">순위</th><th scope="col">팀</th>
            <th scope="col" className="is-number">심사위원 평균</th>
            {legacyBonus && <th scope="col" className="is-number">가산점 합계</th>}
            {bonusItems.map(item => <th key={item.itemId} scope="col" className="is-number">{item.name}{item.maxScore != null && <small> / {Number(item.maxScore)}점</small>}</th>)}
            <th scope="col" className="is-number">총합</th><th scope="col">평가 결과</th>
          </tr></thead>
          <tbody>
            {!pageTeams.length && <tr><td colSpan={5 + (hasBonus ? Math.max(1, bonusItems.length) : 0)} className="program-results-message">선택한 조건에 맞는 팀이 없습니다.</td></tr>}
            {pageTeams.map(team => {
              const status = RESULT_STATUS[team.teamStatus] ?? RESULT_STATUS.PENDING;
              return <tr key={team.teamId} onClick={event => { event.currentTarget.querySelector('button')?.focus(); openTeam(team); }} className={selected?.teamId === team.teamId ? 'is-selected' : ''}>
                <td className="program-results-rank">{team.rank ?? '—'}</td>
                <td><button type="button" className="program-results-team-link" aria-haspopup="dialog" onClick={event => { event.stopPropagation(); openTeam(team); }}>{team.teamName}</button><span className="program-results-review-count">{team.submittedCount} / {team.assignedCount}명 제출</span></td>
                <td className="is-number">{fmt(team.avg)}</td>
                {legacyBonus && <td className="is-number">{fmt(team.bonusScore)}</td>}
                {bonusItems.map(item => <td key={item.itemId} className="is-number">{fmt(team.bonusScores?.find(score => score.itemId === item.itemId)?.score)}</td>)}
                <td className="is-number program-results-final">{team.final != null ? fmt(team.final) : <span className="program-results-unavailable">산출 불가<small>{team.unavailableReason}</small></span>}</td>
                <td><span className={`program-result-status ${status.className}`}>{status.label}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </TableScroll>
      <nav className="program-results-pagination" aria-label="평가 결과 페이지">
        <span>{filtered.length ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)} / ${filtered.length}팀` : '0팀'}</span>
        <div><Button variant="ghost" disabled={page === 1} onClick={() => updateParams({ resultPage: page - 1 })}>이전</Button><span aria-live="polite">{page} / {pageCount}</span><Button variant="ghost" disabled={page === pageCount} onClick={() => updateParams({ resultPage: page + 1 })}>다음</Button></div>
      </nav>
    </section>
    <aside className="program-results-sidebar" aria-label="점수 분포와 내보내기">
      <section className="program-results-distribution bg-white rounded-xl border border-gray-200 p-5" aria-labelledby="results-distribution-title">
        <h3 id="results-distribution-title" className="text-sm font-semibold text-gray-700 mb-4">총합 점수 분포</h3>
        <p className="program-results-method-rule">{RESULT_METHODS[method]} · 산출 가능 {calculable.length}팀 기준</p>
        <div className="program-results-chart flex items-end justify-between gap-2 h-28" role="img" aria-label={buckets.map(bucket=>`${bucket.label}점 구간 ${bucket.count}팀`).join(', ')}>
          {buckets.map(bucket => <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"><span className="text-xs text-gray-600">{bucket.count || ''}</span><div className="w-full bg-blue-500 rounded-t" style={{height:`${bucket.count/maxBucket*100}%`,minHeight:bucket.count ? '4px':'0'}}/><span className="text-xs text-gray-500">{bucket.label}</span></div>)}
        </div>
      </section>
      <ProgramResultsExports method={method} pending={exportPending} error={exportError} onExport={exportFile}/>
    </aside>
    </div>
    {selected && <EvaluationResultDialog key={selected.teamId} team={selected} method={method} hasBonus={hasBonus}
      criteriaQuery={criteriaQuery} pending={statusMutation.isPending} nextTeam={nextTeam} message={message}
      onClose={() => updateParams({ resultTeam: null })} onSave={saveVerdict} onOpenTeam={goToTeamInfo} />}
  </div>;
}
