import { useNavigate } from 'react-router-dom';
import { getEvaluatorAssignments } from '../api/evaluations';
import { getSessionUser } from '../api/auth';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { useScheduleNow } from '../query/useScheduleNow';
import { formatProgramPeriod } from '../utils/programSchedule';
import { evaluationPeriod, scheduleNow } from '../utils/evaluationPeriod';

const STATUS_CONFIG = {
  SUBMITTED: {
    label: '제출 완료',
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border border-green-200',
    action: '심사 보기',
    actionStyle: 'border border-gray-200 text-gray-600 hover:bg-gray-50',
  },
  IN_PROGRESS: {
    label: '임시저장',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    action: '이어서 심사',
    actionStyle: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  ASSIGNED: {
    label: '심사 전',
    dot: 'bg-gray-300',
    badge: 'bg-gray-50 text-gray-500 border border-gray-200',
    action: '심사 시작',
    actionStyle: 'bg-blue-600 text-white hover:bg-blue-700',
  },
};

export default function EvaluatorDashboardPage() {
  const navigate = useNavigate();
  const now = useScheduleNow();
  const { data: assignments = [], isPending: loading, isError, dataUpdatedAt } = useLiveApiQuery(
    queryKeys.evaluatorAssignments,
    () => getEvaluatorAssignments(),
  );
  const { data: user = {} } = useLiveApiQuery(queryKeys.currentUser, () => getSessionUser(), {
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
  const error = isError ? '배정 목록을 불러오는데 실패했습니다.' : '';
  const userName = user.name || user.email?.split('@')[0] || '심사위원';

  const totalTeams = assignments.reduce((sum, a) => sum + a.teamCount, 0);
  const submittedTeams = assignments.reduce((sum, a) => sum + a.submittedCount, 0);
  const draftTeams = assignments.reduce((sum, a) => sum + a.draftCount, 0);
  const pendingTeams = Math.max(0, totalTeams - submittedTeams - draftTeams);

  const progressPercent = totalTeams > 0
    ? Math.round((submittedTeams / totalTeams) * 100) : 0;

  if (loading)
    return (
      <div className="h-full overflow-auto p-8 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );

  if (error)
    return (
      <div className="h-full overflow-auto p-8 flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer"
        >
          다시 로그인
        </button>
      </div>
    );

  return (
    <div className="h-full overflow-auto">
      <div className="p-8">
        {/* 상단 브레드크럼 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>EvalHub</span>
            <span>›</span>
            <span className="text-gray-600 font-medium">내 심사</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-blue-50 text-blue-700 border-blue-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              프로그램 {assignments.length}개
            </div>
          </div>
        </div>

        {/* 웰컴 배너 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-0.5">
                  안녕하세요, <span className="text-blue-700">{userName}</span>님
                </h1>
                <p className="text-sm text-gray-600">
                  배정된 {assignments.length}개 프로그램에서 {pendingTeams}팀의 심사가 남아 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-8 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{assignments.length}</div>
                <div className="text-xs text-gray-500">프로그램</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{submittedTeams}</div>
                <div className="text-xs text-gray-500">심사 완료 팀</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-500">{draftTeams}</div>
                <div className="text-xs text-gray-500">임시저장 팀</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>팀 심사 진행률</span>
              <span>{submittedTeams} / {totalTeams}팀 · {progressPercent}%</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 배정 목록 */}
        {assignments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 text-lg">배정된 심사 프로그램이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                프로그램 목록 ({assignments.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((assignment) => {
                const config = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.ASSIGNED;
                return (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    programTitle={assignment.programTitle}
                    config={config}
                    period={evaluationPeriod(assignment, scheduleNow(assignment.schedule, dataUpdatedAt, now))}
                    onEvaluate={() =>
                      navigate(`/evaluator/evaluate/${assignment.id}/teams`, {
                        state: {
                          programId: assignment.programId,
                          programTitle: assignment.programTitle,
                          evaluationStart: assignment.evaluationStart,
                          evaluationDeadline: assignment.evaluationDeadline,
                        },
                      })
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, programTitle, config, onEvaluate, period }) {
  const periodText = formatProgramPeriod(assignment, 'evaluation');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* 상태 배지 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
            {config.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">{period.label}</p>

      {/* 프로그램 정보 */}
      <h3 className="font-bold text-gray-900 mb-1">{programTitle}</h3>
      <p className="text-sm text-gray-500 mb-3">심사 대상 {assignment.teamCount}팀</p>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2 mb-4">
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>심사 기간 {periodText}</span>
      </div>

      {/* 팀별 심사 진행률 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500">
            제출 <span className="font-semibold text-gray-800">{assignment.submittedCount}</span>
            <span className="text-gray-400"> / {assignment.teamCount}팀</span>
          </span>
          {assignment.draftCount > 0 && (
            <span className="text-amber-600">임시저장 {assignment.draftCount}</span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              assignment.teamCount > 0 && assignment.submittedCount === assignment.teamCount
                ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{
              width: assignment.teamCount > 0
                ? `${Math.round((assignment.submittedCount / assignment.teamCount) * 100)}%`
                : '0%',
            }}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <button
        onClick={onEvaluate}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${config.actionStyle}`}
      >
        {period.canEvaluate ? config.action : '자료·심사 보기'}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
