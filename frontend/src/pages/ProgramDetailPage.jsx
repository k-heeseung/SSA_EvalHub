import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { programTypeLabel } from '../utils/labels';
import {
  getPrograms, getTeams, getEvaluatorsByProgram, getAssignmentsByProgram,
  createAssignment, cancelAssignment, getEvaluationResults, getCriteria,
} from '../api/programs';
import { getEvaluators } from '../api/evaluators';
import ProgramResultsPanel from '../components/ProgramResultsPanel';
import BreadcrumbTrail from '../components/BreadcrumbTrail';
import { formatProgramPeriod } from '../utils/programSchedule';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import ProgramTeamsPanel from '../components/ProgramTeamsPanel';
import { programProgress } from '../utils/teamProgress';
import './ProgramDetailPage.css';

// 프로그램 라이프사이클: DRAFT → SCHEDULED → RECRUITING → PENDING_EVALUATION → ACTIVE → INACTIVE
const PROGRAM_STATUS = {
  DRAFT:      { label: '임시 저장',      dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-500'     },
  SCHEDULED:  { label: '접수 예정',      dot: 'bg-violet-400',  pill: 'bg-violet-100 text-violet-700' },
  RECRUITING: { label: '지원 접수',   dot: 'bg-amber-400',   pill: 'bg-amber-100 text-amber-700'   },
  PENDING_EVALUATION: { label: '평가 대기', dot: 'bg-sky-400', pill: 'bg-sky-100 text-sky-700' },
  ACTIVE:     { label: '평가 진행', dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700'     },
  INACTIVE:   { label: '평가 완료',      dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-500'     },
};



export default function ProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Keep legacy numeric entry points while giving every tab a stable URL.
  const legacyTab = ['teams', 'criteria', 'assignments', 'results'][state?.defaultTab];
  const requestedTab = searchParams.get('tab') ?? legacyTab;
  const activeTab = ['overview', 'teams', 'criteria', 'assignments', 'results'].includes(requestedTab) ? requestedTab : 'overview';
  const setActiveTab = (tab) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('tab', tab);
    return next;
  }, { replace: true, state });
  // 어디서 들어왔는지에 따라 상단 '이전' 버튼이 돌아갈 곳을 정한다. (기본값: 프로그램 목록)
  const back = state?.back ?? { path: '/admin/programs', label: '프로그램' };
  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const teamsQuery = useLiveApiQuery(queryKeys.teams(programId), () => getTeams(programId));
  const criteriaQuery = useLiveApiQuery(queryKeys.criteria(programId), () => getCriteria(programId));
  const evaluatorsQuery = useLiveApiQuery(
    queryKeys.programEvaluators(programId),
    () => getEvaluatorsByProgram(programId),
  );
  const program = (programsQuery.data ?? []).find((item) => item.id === Number(programId)) ?? null;
  const teamCount = teamsQuery.data?.length ?? 0;
  const criteriaCount = criteriaQuery.data?.length ?? 0;
  const evaluatorCount = evaluatorsQuery.data?.length ?? 0;
  const loading = programsQuery.isPending || teamsQuery.isPending
    || criteriaQuery.isPending || evaluatorsQuery.isPending;
  const resultsQuery = useLiveApiQuery(queryKeys.evaluationResults(programId), () => getEvaluationResults(programId));
  const progress = programProgress(teamsQuery.data ?? [], resultsQuery.data ?? [], teamsQuery.isSuccess && resultsQuery.isSuccess);
  const evaluationRate = progress.rate;

  if (loading) return <div className="ui-page text-gray-500">로딩 중...</div>;
  if (!program) return <div className="ui-page text-red-500">프로그램을 찾을 수 없습니다.</div>;

  const tabs = [
    { id: 'overview', label: '개요', count: null },
    { id: 'teams', label: '지원 팀', count: teamCount },
    { id: 'criteria', label: '평가 기준', count: criteriaCount },
    { id: 'assignments', label: '심사위원 배정', count: evaluatorCount },
    { id: 'results', label: '평가 결과', count: null },
  ];

  return (
    <div className="ui-page program-detail-page min-h-full min-w-0">
      <BreadcrumbTrail items={['평가ON', { label:back.label, onClick:() => navigate(back.path) }, program.title]} />

      <header className="program-detail-header">
        <div className="program-detail-heading-row">
          <div className="program-detail-identity">
            <div className="program-detail-title-row">
              <h1 className="ui-page-title">{program.title}</h1>
              <span className={`program-detail-status ${(PROGRAM_STATUS[program.status] ?? PROGRAM_STATUS.DRAFT).pill}`}>
                {(PROGRAM_STATUS[program.status] ?? PROGRAM_STATUS.DRAFT).label}
              </span>
            </div>
            <p className="program-detail-type">{programTypeLabel(program.type)}</p>
          </div>
        <div className="program-detail-actions" role="group" aria-label="프로그램 관리">
          {program.bonusEnabled && (
            <button
              onClick={() => {
                const first = (teamsQuery.data ?? [])[0];
                if (first) navigate(`/admin/programs/${programId}/bonus/${first.teamId}`);
              }}
              disabled={(teamsQuery.data ?? []).length === 0}
              className="ui-button program-detail-action"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              가산점 입력
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/programs/${programId}/edit`)}
            className="ui-button program-detail-action"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            정보 수정
          </button>

        </div>
        </div>
      </header>

      <section className="program-detail-workspace" data-active-tab={activeTab} aria-label="프로그램 업무 영역">
      <div className="ui-tabs flex gap-0" role="group" aria-label="프로그램 업무">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `program-panel-${tab.id}` : undefined}
            className="ui-button ui-button--ghost flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium">
            {tab.label}
            {tab.count !== null && <span className="program-detail-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="program-detail-tab-content" id={`program-panel-${activeTab}`}>
      {activeTab === 'overview' && <div className="program-overview-layout">
      <section aria-label="프로그램 정보">
        <h2>프로그램 정보</h2>
          <dl className="program-detail-overview">
            <div><dt>프로그램 설명</dt><dd>{program.description?.trim() || '등록된 설명이 없습니다.'}</dd></div>
            <div><dt>지원 자격</dt><dd>{program.eligibilityCriteria?.trim() || '등록된 지원 자격이 없습니다.'}</dd></div>
          </dl>
        <dl className="program-detail-schedule">
          <div><dt>지원 기간</dt><dd>{formatProgramPeriod(program, 'application')}</dd></div>
          <div><dt>평가 기간</dt><dd>{formatProgramPeriod(program, 'evaluation')}</dd></div>
        </dl>
      </section>
      <section aria-label="운영 현황">
        <h2>운영 현황</h2>
        <dl className="program-detail-metrics">
          <div><dt>지원 팀</dt><dd>{teamCount}</dd></div>
          <div><dt>심사위원</dt><dd>{evaluatorCount}</dd></div>
          <div><dt>심사 완료율</dt><dd>{evaluationRate == null ? '—' : `${evaluationRate}%`}</dd></div>
          <div><dt>판정 미정</dt><dd>{resultsQuery.isSuccess ? `${(resultsQuery.data ?? []).filter(team => team.teamStatus === 'PENDING').length}팀` : '—'}</dd></div>
        </dl>
        <button type="button" className="ui-button ui-button--primary" onClick={() => setActiveTab('results')}>평가 결과 검토</button>
      </section>
      </div>}
      {activeTab === 'teams' && <ProgramTeamsPanel programId={programId} program={program} />}
      {activeTab === 'criteria' && <CriteriaTab programId={programId} />}
      {activeTab === 'assignments' && <AssignmentTab programId={programId} />}
      {activeTab === 'results' && <ProgramResultsPanel programId={programId} program={program} />}
      </div>
      </section>
    </div>
  );
}

function CriteriaTab({ programId }) {
  const { data: criteria = [], isPending: loading } = useLiveApiQuery(
    queryKeys.criteria(programId),
    () => getCriteria(programId),
  );

  if (loading) return <div className="text-gray-500">로딩 중...</div>;
  if (criteria.length === 0)
    return (
      <div className="program-detail-empty text-center py-16">
        <p className="text-gray-500">등록된 평가 기준이 없습니다.</p>
      </div>
    );

  return (
    <div className="program-detail-criteria">
      {criteria.map((c, index) => (
        <div key={c.id} className="program-detail-criterion p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  기준 {index + 1}
                </span>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <span className="text-xs text-gray-500">0~{c.maxScore}점</span>
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 mt-2">{c.description}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentTab({ programId }) {
  const [cancelTarget, setCancelTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const evaluatorsQuery = useLiveApiQuery(
    queryKeys.programEvaluators(programId),
    () => getEvaluatorsByProgram(programId),
  );
  const assignmentsQuery = useLiveApiQuery(
    queryKeys.programAssignments(programId),
    () => getAssignmentsByProgram(programId),
  );
  const allEvaluatorsQuery = useLiveApiQuery(queryKeys.evaluators, () => getEvaluators());
  const assignedEvaluators = evaluatorsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const allEvaluators = allEvaluatorsQuery.data ?? [];
  const loading = evaluatorsQuery.isPending || assignmentsQuery.isPending || allEvaluatorsQuery.isPending;
  const cancelMutation = useMutation({ mutationFn: cancelAssignment });


  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  const assignedIds = new Set(assignedEvaluators.map((e) => e.id));
  const unassignedEvaluators = allEvaluators.filter((e) => e.status === 'ACTIVE' && !assignedIds.has(e.id));

  return (
    <div className="program-detail-assignment">
      <div className="program-detail-assignment-table bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="ui-table-scroll"><table className="program-assignment-table min-w-[40rem] w-full">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="text-left px-6 text-xs font-medium text-gray-500">심사위원</th>
                <th scope="col" className="text-left px-6 text-xs font-medium text-gray-500">평가 상태</th>
                <th scope="col" className="program-assignment-actions px-6 text-right">
                  <button type="button" onClick={() => setShowModal(true)} className="ui-button ui-button--primary program-assignment-add">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
                    심사위원 배정
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {assignedEvaluators.length === 0 && (
                <tr><td colSpan={3} className="text-center py-12 text-gray-500">배정된 심사위원이 없습니다.</td></tr>
              )}
              {assignedEvaluators.map((evaluator) => {
                const assignment = assignments.find((a) => a.evaluatorId === evaluator.id);
                return (
                  <tr key={evaluator.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{evaluator.deleted ? '삭제된 심사위원' : evaluator.email}</td>
                    <td className="px-6 py-4">
                      <AssignmentStatusBadge status={assignment?.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setCancelTarget({ id: assignment?.id, email: evaluator.deleted ? '삭제된 심사위원' : evaluator.email })}
                        disabled={!assignment}
                        className="ui-button ui-button--ghost text-sm text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        배정 취소
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
      </div>

      {cancelTarget && (
        <CancelAssignmentDialog
          evaluatorEmail={cancelTarget.email}
          pending={cancelMutation.isPending}
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => {
            await cancelMutation.mutateAsync(cancelTarget.id);
            setCancelTarget(null);
          }}
        />
      )}

      {showModal && (
        <AssignEvaluatorModal
          evaluators={unassignedEvaluators}
          programId={programId}
          onClose={() => setShowModal(false)}
          onAssigned={() => { setShowModal(false); }}
        />
      )}
    </div>
  );
}

function CancelAssignmentDialog({ evaluatorEmail, pending, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  const handleConfirm = async () => {
    if (pending) return;
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.response?.data?.message || '배정 취소에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="assignment-cancel-dialog"
      aria-labelledby="assignment-cancel-title"
      aria-describedby="assignment-cancel-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <h2 id="assignment-cancel-title">심사위원 배정을 취소할까요?</h2>
      <p id="assignment-cancel-description"><strong>{evaluatorEmail}</strong>님의 프로그램 배정을 취소합니다.</p>
      <p>이 배정과 해당 평가 기록이 삭제되며 복구할 수 없습니다. 기존 평가는 결과에서 제외되고 평균·순위가 변경될 수 있습니다.</p>
      {error && <p className="assignment-cancel-error" role="alert">{error}</p>}
      <div className="assignment-cancel-footer">
        <button type="button" className="ui-button ui-button--secondary" autoFocus disabled={pending} onClick={onClose}>돌아가기</button>
        <button type="button" className="ui-button assignment-cancel-confirm" disabled={pending} onClick={handleConfirm}>{pending ? '취소 중…' : '배정 취소'}</button>
      </div>
    </dialog>
  );
}

function AssignmentStatusBadge({ status }) {
  const map = {
    ASSIGNED: { label: '배정됨', style: 'bg-blue-50 text-blue-700' },
    IN_PROGRESS: { label: '평가 중', style: 'bg-amber-50 text-amber-700' },
    SUBMITTED: { label: '평가 완료', style: 'bg-green-50 text-green-700' },
  };
  const info = map[status] || { label: '—', style: 'bg-gray-50 text-gray-500' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.style}`}>{info.label}</span>
  );
}

function AssignEvaluatorModal({ evaluators, programId, onClose, onAssigned }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState('');
  const createMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => createAssignment(programId, { evaluatorId: id }))),
  });
  const submitting = createMutation.isPending;

  const toggleEvaluator = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) { setError('심사위원을 한 명 이상 선택해주세요.'); return; }
    try {
      await createMutation.mutateAsync([...selectedIds]);
      onAssigned();
    } catch (err) {
      setError(err.response?.data?.message || '배정에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">심사위원 배정</h2>
          <button onClick={onClose} className="ui-button ui-button--ghost text-gray-500 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              심사위원 선택 {selectedIds.size > 0 && <span className="text-blue-600 font-normal">({selectedIds.size}명)</span>}
            </label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-60 overflow-y-auto">
              {evaluators.map((e) => (
                <label key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(e.id)}
                    onChange={() => toggleEvaluator(e.id)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-800">{e.email}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="ui-button ui-button--ghost flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">취소</button>
            <button type="submit" disabled={submitting} className="ui-button ui-button--primary flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {submitting ? '배정 중...' : '배정하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

