import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTeams, getEvaluationResults } from '../api/programs';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { bonusSummary } from '../utils/bonus';
import { programProgress } from '../utils/teamProgress';

const STATUSES = {
  PENDING: '평가 전', IN_PROGRESS: '평가 중', COMPLETE: '평가 완료',
  UNASSIGNED: '미배정', UNKNOWN: '확인 필요',
};

export default function ProgramTeamsPanel({ programId, program }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [bonusTeam, setBonusTeam] = useState(null);
  const teamsQuery = useLiveApiQuery(queryKeys.teams(programId), () => getTeams(programId), { retryOnMount: false });
  const resultsQuery = useLiveApiQuery(queryKeys.evaluationResults(programId), () => getEvaluationResults(programId), { retryOnMount: false });
  const teams = teamsQuery.data ?? [];
  const results = resultsQuery.data ?? [];
  const available = resultsQuery.isSuccess;
  const summary = programProgress(teams, results, available);
  const resultByTeam = new Map(results.map((result) => [result.teamId, result]));
  const hasBonus = Boolean(program?.bonusEnabled);
  const counts = Object.fromEntries(Object.keys(STATUSES).map((key) => [key, summary.rows.filter((team) => team.progress.status === key).length]));
  const filters = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETE', ...['UNASSIGNED', 'UNKNOWN'].filter((key) => counts[key] || filter === key)];
  const query = search.trim().toLocaleLowerCase();
  const filtered = summary.rows.filter((team) => (filter === 'ALL' || team.progress.status === filter)
    && (!query || `${team.name ?? ''} ${team.displayName ?? ''} ${team.description ?? ''}`.toLocaleLowerCase().includes(query)));
  const clear = () => { setSearch(''); setFilter('ALL'); };

  if (teamsQuery.isPending) return <p role="status" className="program-teams-message">지원 팀을 불러오는 중입니다.</p>;

  return (
    <section className="program-teams" aria-label="지원 팀 목록">
      {teamsQuery.isError && <QueryNotice query={teamsQuery}>지원 팀 목록을 {teamsQuery.data ? '갱신하지 못했습니다. 이전 목록을 표시합니다.' : '불러오지 못했습니다.'}</QueryNotice>}
      {resultsQuery.isError && <QueryNotice query={resultsQuery}>심사 진행 정보를 불러오지 못했습니다. 평가 상태와 완료 건수는 확인할 수 없습니다.</QueryNotice>}
      <div className="program-teams-toolbar">
        <label className="program-teams-search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
          <input type="search" className="ui-input" aria-label="팀명 또는 프로젝트 설명 검색" placeholder="팀명·프로젝트 설명 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="program-teams-filters" role="group" aria-label="팀 평가 상태">
          {filters.map((key) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className="ui-button ui-button--ghost">{key === 'ALL' ? '전체' : STATUSES[key]}<span>{key === 'ALL' ? teams.length : available ? counts[key] : '—'}</span></button>)}
        </div>
        <p className="program-teams-total" aria-live="polite">심사 완료 <strong>{summary.known && !teamsQuery.isError ? `${summary.completed} / ${summary.assigned}건` : '—'}</strong></p>
      </div>
      {(query || filter !== 'ALL') && <div className="program-teams-search-result" role="status">조건에 맞는 팀 {filtered.length}팀<button type="button" className="ui-button ui-button--ghost" onClick={clear}>조건 초기화</button></div>}
      {teamsQuery.isError && !teamsQuery.data ? <p className="program-teams-message">목록을 다시 불러와 주세요.</p> : !filtered.length ? <div className="program-teams-message"><p>{teams.length ? '선택한 조건에 맞는 팀이 없습니다.' : '제출된 지원 팀이 없습니다.'}</p>{teams.length > 0 && <button type="button" className="ui-button" onClick={clear}>조건 초기화</button>}</div> : (
        <div className="ui-table-scroll"><table className="program-teams-table">
          <thead><tr><th scope="col">번호</th><th scope="col">팀 · 프로젝트</th><th scope="col">팀원</th>{hasBonus && <th scope="col">가산점</th>}<th scope="col">심사 진행</th><th scope="col">평가 상태</th><th scope="col"><span className="sr-only">상세 보기</span></th></tr></thead>
          <tbody>{filtered.map((team) => {
            const info = team.applicantInfo ?? {};
            const isTeam = team.participantType === 'TEAM';
            const names = [info.name, ...(info.members ?? []).map((member) => member.name)].filter(Boolean);
            const result = resultByTeam.get(team.teamId);
            const bonusScores = result?.bonusScores ?? team.bonusScores ?? [];
            const total = bonusScores.length ? bonusSummary(bonusScores).total : result?.bonusScore ?? team.bonusScore ?? null;
            const path = `/operations/programs/${programId}/teams/${team.teamId}`;
            return <tr key={team.teamId} onClick={() => navigate(path)}>
              <td className="program-teams-number">#{String(team.number).padStart(2, '0')}</td>
              <td className="program-teams-identity"><Link to={path} className="program-teams-name" onClick={(event) => event.stopPropagation()}>{team.name || team.displayName}</Link>{team.description?.trim() && <p className="program-teams-description">{team.description.trim()}</p>}{info.name && <p className="program-teams-leader">{isTeam ? '팀장' : '지원자'} · {info.name}</p>}</td>
              <td><div className="program-teams-members" title={names.join(', ')}>{names.slice(0, 5).map((name, index) => <span key={index} className="program-teams-avatar" aria-hidden="true">{name.slice(0, 1)}</span>)}<span>{isTeam ? `${team.memberCount ?? names.length}명` : '개인'}</span></div></td>
              {hasBonus && <td><button type="button" className="program-teams-bonus" aria-label={`${team.name} 가산점 내역 보기`} onClick={(event) => { event.stopPropagation(); setBonusTeam({ ...team, bonusScores, total }); }}>{total == null ? '미입력' : `${Number(total) > 0 ? '+ ' : ''}${Number(total)}점`}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg></button></td>}
              <td><TeamProgress progress={team.progress} loading={resultsQuery.isPending} /></td>
              <td><span className={`program-teams-status program-teams-status--${team.progress.status.toLowerCase()}`}>{resultsQuery.isPending ? '조회 중' : STATUSES[team.progress.status]}</span></td>
              <td><Link to={path} className="program-teams-detail" aria-label={`${team.name} 상세 보기`} onClick={(event) => event.stopPropagation()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m9 5 7 7-7 7" /></svg></Link></td>
            </tr>;
          })}</tbody>
        </table></div>
      )}
      <p className="program-teams-footnote">최종 제출된 심사만 완료 건수에 포함됩니다. 평균·총점은 ‘평가 결과’에서 확인하세요.</p>
      {bonusTeam && <TeamBonusDialog team={bonusTeam} onClose={() => setBonusTeam(null)} />}
    </section>
  );
}

function QueryNotice({ query, children }) {
  return <div className="program-teams-error" role="alert"><p>{children}</p><button type="button" className="ui-button" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? '다시 불러오는 중…' : '다시 불러오기'}</button></div>;
}

function TeamProgress({ progress, loading }) {
  if (loading || progress.status === 'UNKNOWN') return <span className="program-teams-muted">{loading ? '조회 중…' : '진행 확인 필요'}</span>;
  if (!progress.assigned) return <span className="program-teams-muted">심사위원 미배정</span>;
  return <div className={`program-team-progress ${progress.status === 'COMPLETE' ? 'is-complete' : ''}`}>
    <div className={`program-team-progress-track ${progress.assigned > 8 ? 'is-continuous' : ''}`} aria-hidden="true">
      {progress.assigned <= 8 ? Array.from({ length: progress.assigned }, (_, index) => <span key={index} className={index < progress.completed ? 'is-done' : ''} />) : <span className="is-done" style={{ width: `${progress.completed / progress.assigned * 100}%` }} />}
    </div>
    <p>{progress.completed} / {progress.assigned} 심사 완료{progress.status === 'IN_PROGRESS' && ` · ${progress.assigned - progress.completed}명 남음`}</p>
  </div>;
}

function TeamBonusDialog({ team, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="program-team-bonus-dialog" aria-labelledby="team-bonus-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="team-bonus-title">가산점 내역</h2><p className="program-team-bonus-name">{team.name}</p>
    {team.bonusScores.length ? <dl>{team.bonusScores.map((item) => <div key={item.itemId}><dt>{item.name}</dt><dd>{item.score == null ? '미입력' : `${item.score}점`}{item.maxScore != null && <span> / {item.maxScore}점</span>}</dd></div>)}</dl> : <p className="program-teams-muted">{team.total == null ? '입력된 가산점이 없습니다.' : '항목별 내역이 없는 기존 가산점입니다.'}</p>}
    <div className="program-team-bonus-total">합계 <strong>{team.total == null ? '미입력' : `${team.total}점`}</strong></div><div className="program-team-bonus-footer"><button type="button" className="ui-button" autoFocus onClick={onClose}>닫기</button></div>
  </dialog>;
}
