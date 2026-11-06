import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { programTypeLabel } from '../utils/labels';
import {
  getPrograms, getTeams, getEvaluatorsByProgram, getAssignmentsByProgram,
  createAssignment, cancelAssignment, changeStatus, getEvaluationResults, getCriteria,
} from '../api/programs';
import { getEvaluators } from '../api/evaluators';
import ProgramResultsPanel from '../components/ProgramResultsPanel';
import { formatProgramPeriod } from '../utils/programSchedule';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { teamAverage, teamBonus, teamFinalScore } from '../utils/export';

const EVALUATION_STATUS = {
  PENDING: { label: '평가 전', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  IN_PROGRESS: { label: '평가 중', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
  COMPLETE: { label: '평가 완료', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
};

// 프로그램 라이프사이클: DRAFT → SCHEDULED → RECRUITING → PENDING_EVALUATION → ACTIVE → INACTIVE
const PROGRAM_STATUS = {
  DRAFT:      { label: '임시 저장',      dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-500'     },
  SCHEDULED:  { label: '접수 예정',      dot: 'bg-violet-400',  pill: 'bg-violet-100 text-violet-700' },
  RECRUITING: { label: '지원 접수',   dot: 'bg-amber-400',   pill: 'bg-amber-100 text-amber-700'   },
  PENDING_EVALUATION: { label: '평가 대기', dot: 'bg-sky-400', pill: 'bg-sky-100 text-sky-700' },
  ACTIVE:     { label: '평가 진행', dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700'     },
  INACTIVE:   { label: '평가 완료',      dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-500'     },
};
const PROGRAM_STATUS_ORDER = ['DRAFT', 'SCHEDULED', 'RECRUITING', 'PENDING_EVALUATION', 'ACTIVE', 'INACTIVE'];



export default function ProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [activeTab, setActiveTab] = useState(state?.defaultTab ?? 0);
  // 어디서 들어왔는지에 따라 상단 '이전' 버튼이 돌아갈 곳을 정한다. (기본값: 프로그램 목록)
  const back = state?.back ?? { path: '/admin/programs', label: '프로그램' };
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);
  const queryClient = useQueryClient();
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
  const statusMutation = useMutation({
    mutationFn: (newStatus) => changeStatus(program.id, { status: newStatus }),
  });
  const togglingStatus = statusMutation.isPending;
  const evaluationRate = evaluatorCount > 0
    ? Math.round(((program?.submittedCount ?? 0) / evaluatorCount) * 100)
    : 0;

  useEffect(() => {
    if (!statusMenuOpen) return;
    const handleClickOutside = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setStatusMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusMenuOpen]);

  const handleChangeStatus = async (newStatus) => {
    if (newStatus === program.status) { setStatusMenuOpen(false); return; }
    try {
      const res = await statusMutation.mutateAsync(newStatus);
      queryClient.setQueryData(queryKeys.programs, (current = []) => (
        current.map((item) => (item.id === res.data.id ? res.data : item))
      ));
      setStatusMenuOpen(false);
    } catch {
      alert('상태 변경에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">로딩 중...</div>;
  if (!program) return <div className="p-8 text-red-500">프로그램을 찾을 수 없습니다.</div>;

  const tabs = [
    { label: '지원 팀', count: teamCount },
    { label: '평가 질문', count: criteriaCount },
    { label: '할당 평가자', count: evaluatorCount },
    { label: '평가 결과', count: null },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 상단 네비게이션 바 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center h-12 px-4 gap-3">
        <button
          onClick={() => navigate(back.path)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {back.label}
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <span className="text-sm font-semibold text-gray-800">{program.title}</span>

        <div className="ml-auto flex items-center gap-2">
          {program.bonusEnabled && (
            <button
              onClick={() => {
                const first = (teamsQuery.data ?? [])[0];
                if (first) navigate(`/admin/programs/${programId}/bonus/${first.teamId}`);
              }}
              disabled={(teamsQuery.data ?? []).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              가산점 입력
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/programs/${programId}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            정보 수정
          </button>
          <div className="relative" ref={statusMenuRef}>
            <button
              onClick={() => setStatusMenuOpen((v) => !v)}
              disabled={togglingStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              상태 변경
              <svg className={`w-4 h-4 transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-20">
                {PROGRAM_STATUS_ORDER.map((key) => {
                  const info = PROGRAM_STATUS[key];
                  const isCurrent = program.status === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleChangeStatus(key)}
                      disabled={togglingStatus}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 cursor-pointer ${
                        isCurrent ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${info.dot}`} />
                      <span className="flex-1">{info.label}</span>
                      {isCurrent && (
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* 프로그램 헤더 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3h14M5 3a2 2 0 00-2 2v3a7 7 0 007 7m-5-10h10m0 0a2 2 0 012 2v3a7 7 0 01-7 7m0 0v3m0 0h-4m4 0h4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-gray-900">{program.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                (PROGRAM_STATUS[program.status] ?? PROGRAM_STATUS.DRAFT).pill
              }`}>
                {(PROGRAM_STATUS[program.status] ?? PROGRAM_STATUS.DRAFT).label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{programTypeLabel(program.type)}</span>
              <span>·</span>
              <span>지원 기간 {formatProgramPeriod(program, 'application')}</span>
              <span>·</span>
              <span>평가 기간 {formatProgramPeriod(program, 'evaluation')}</span>
              {program.eligibilityCriteria && (
                <>
                  <span>·</span>
                  <span>{program.eligibilityCriteria}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 text-right">
          <div>
            <div className="text-2xl font-bold text-gray-900">{teamCount}</div>
            <div className="text-xs text-gray-400">지원 팀</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{evaluatorCount}</div>
            <div className="text-xs text-gray-400">심사위원</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{evaluationRate}%</div>
            <div className="text-xs text-gray-400">평가율</div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
              activeTab === i
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === i ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 0 && <TeamsTab programId={programId} program={program} />}
      {activeTab === 1 && <CriteriaTab programId={programId} />}
      {activeTab === 2 && <AssignmentTab programId={programId} />}
      {activeTab === 3 && <ProgramResultsPanel programId={programId} program={program} />}
      </div>
    </div>
  );
}

function TeamsTab({ programId, program }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const teamsQuery = useLiveApiQuery(queryKeys.teams(programId), () => getTeams(programId));
  const resultsQuery = useLiveApiQuery(
    queryKeys.evaluationResults(programId),
    () => getEvaluationResults(programId),
  );
  const evaluationResults = resultsQuery.data ?? [];
  const resultByTeam = new Map(evaluationResults.map((result) => [result.teamId, result]));
  const hasBonus = program?.bonusEnabled || evaluationResults.some((result) => result.bonusScore != null);
  const teams = (teamsQuery.data ?? []).map((team) => {
    const result = resultByTeam.get(team.teamId);
    const scoreResult = {
      evaluations: result?.evaluations ?? [],
      bonusScore: result?.bonusScore ?? team.bonusScore ?? null,
    };
    const evaluations = scoreResult.evaluations;
    const submitted = evaluations.filter((evaluation) => evaluation.submission?.status === 'SUBMITTED');
    const started = evaluations.some((evaluation) => evaluation.submission);
    const evaluationStatus = evaluations.length > 0 && submitted.length === evaluations.length
      ? 'COMPLETE'
      : started ? 'IN_PROGRESS' : 'PENDING';
    return {
      ...team,
      hasSubmission: team.attachmentCount > 0 || Boolean(team.submissionUrl?.trim()),
      evaluationStatus,
      averageScore: teamAverage(scoreResult),
      bonusScore: scoreResult.bonusScore,
      bonus: teamBonus(scoreResult),
      totalScore: teamFinalScore(scoreResult),
    };
  });
  const loading = teamsQuery.isPending || resultsQuery.isPending;

  const filterButtons = [
    { key: 'ALL', label: '전체' },
    { key: 'PENDING', label: '평가 전' },
    { key: 'FINISHED', label: '평가 완료' },
  ];

  const filtered = teams.filter((t) => {
    if (filter === 'FINISHED') {
      if (t.evaluationStatus !== 'COMPLETE') return false;
    } else if (filter !== 'ALL' && t.evaluationStatus !== filter) {
      return false;
    }
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="팀명 검색…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-52"
          />
        </div>
        <div className="flex gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                filter === btn.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">
          {teams.length}팀 · 제출 {teams.filter((team) => team.hasSubmission).length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">등록된 팀이 없습니다.</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">번호</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">팀</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">팀원</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">제출물</th>
              {hasBonus ? (
                <>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">심사위원 평균</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">가산점</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">총합</th>
                </>
              ) : (
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">심사위원 평균</th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((team, index) => {
              const s = EVALUATION_STATUS[team.evaluationStatus] || EVALUATION_STATUS.PENDING;
              const isTeam = team.participantType === 'TEAM';
              const info = team.applicantInfo || {};
              // 백엔드와 evaluator가 함께 쓰는 지원서 기준 인원수. 계정 연결 수는 사용하지 않는다.
              const memberLabel = isTeam ? `${team.memberCount}명` : '개인';
              const subtitle = isTeam
                ? (info.name ? `팀장 · ${info.name}` : team.description)
                : (info.email || team.description);
              return (
                <tr
                  key={team.teamId}
                  onClick={() => navigate(`/admin/programs/${programId}/teams/${team.teamId}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 text-sm text-gray-400 font-mono">#{String(index + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900 text-sm">{team.name}</div>
                    {subtitle && (
                      <div className="text-xs text-gray-400 line-clamp-1">{subtitle}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{memberLabel}</td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1.5 text-sm text-gray-500">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {team.hasSubmission ? '제출됨' : '미제출'}
                    </span>
                  </td>
                  {hasBonus ? (
                    <>
                      <td className="px-4 py-4 text-sm font-medium text-gray-600">
                        {team.averageScore == null ? '—' : team.averageScore.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-purple-600">
                        {team.bonusScore != null ? `+${team.bonus}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-blue-600">
                        {team.totalScore == null ? '—' : team.totalScore.toFixed(1)}
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                      {team.averageScore == null ? '—' : team.averageScore.toFixed(1)}
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                        {s.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-400">등록된 평가 항목이 없습니다.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {criteria.map((c, index) => (
        <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  Q{index + 1}
                </span>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <span className="text-xs text-gray-400">0~{c.maxScore}점</span>
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 ml-8">{c.description}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentTab({ programId }) {
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

  const handleCancel = async (assignmentId) => {
    if (!window.confirm('배정을 취소하시겠습니까?')) return;
    try {
      await cancelMutation.mutateAsync(assignmentId);
    } catch (err) {
      alert(err.response?.data?.message || '취소에 실패했습니다.');
    }
  };

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  const assignedIds = new Set(assignedEvaluators.map((e) => e.id));
  const unassignedEvaluators = allEvaluators.filter((e) => !assignedIds.has(e.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">
          배정된 심사위원 ({assignedEvaluators.length}명)
        </h2>
        {unassignedEvaluators.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 심사위원 배정
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {assignedEvaluators.length === 0 ? (
          <div className="text-center py-12 text-gray-400">배정된 심사위원이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">심사위원</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {assignedEvaluators.map((evaluator) => {
                const assignment = assignments.find((a) => a.evaluatorId === evaluator.id);
                return (
                  <tr key={evaluator.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{evaluator.email}</td>
                    <td className="px-6 py-4">
                      <AssignmentStatusBadge status={assignment?.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleCancel(assignment?.id)}
                        disabled={assignment?.status === 'SUBMITTED'}
                        className="text-sm text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        배정 취소
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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

function AssignmentStatusBadge({ status }) {
  const map = {
    ASSIGNED: { label: '배정됨', style: 'bg-blue-50 text-blue-700' },
    IN_PROGRESS: { label: '진행 중', style: 'bg-amber-50 text-amber-700' },
    SUBMITTED: { label: '완료', style: 'bg-green-50 text-green-700' },
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">심사위원 배정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
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
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">취소</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {submitting ? '배정 중...' : '배정하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

