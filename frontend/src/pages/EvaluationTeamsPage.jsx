import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAssignmentTeams } from '../api/evaluations';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

// 팀별 본인 채점 상태. submissionStatus 가 없으면 아직 시작하지 않은 팀이다.
const SUBMISSION_STATUS = {
  SUBMITTED: {
    label: '제출 완료', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border border-green-200',
    action: '평가 보기', actionStyle: 'border border-gray-200 text-gray-600 hover:bg-gray-50',
  },
  DRAFT: {
    label: '임시저장', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    action: '이어서 평가', actionStyle: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  NOT_STARTED: {
    label: '미평가', dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-500 border border-gray-200',
    action: '채점하기', actionStyle: 'bg-blue-600 text-white hover:bg-blue-700',
  },
};

const statusOf = (team) => SUBMISSION_STATUS[team.submissionStatus] || SUBMISSION_STATUS.NOT_STARTED;

export default function EvaluationTeamsPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [filter, setFilter] = useState('ALL');

  const programId = state?.programId;
  const programTitle = state?.programTitle;
  const evaluationStart = state?.evaluationStart;
  const evaluationDeadline = state?.evaluationDeadline;
  const evaluationPeriod = evaluationStart && evaluationDeadline
    ? `${evaluationStart} ~ ${evaluationDeadline}`
    : evaluationStart ? `${evaluationStart}부터` : evaluationDeadline ? `~ ${evaluationDeadline}` : '미설정';

  const { data: teams = [], isPending: loading, isError: error } = useLiveApiQuery(
    queryKeys.assignmentTeams(assignmentId),
    () => getAssignmentTeams(assignmentId),
  );

  const handleSelect = (team) => {
    navigate(`/evaluator/evaluate/${assignmentId}/teams/${team.teamId}`, {
      state: { teams, programTitle, programId },
    });
  };

  const submittedCount = teams.filter((t) => t.submissionStatus === 'SUBMITTED').length;
  const draftCount = teams.filter((t) => t.submissionStatus === 'DRAFT').length;
  const notStartedCount = teams.length - submittedCount - draftCount;
  const filterTabs = [
    { key: 'ALL', label: '전체', count: teams.length },
    { key: 'NOT_STARTED', label: '평가 대기', count: notStartedCount },
    { key: 'DRAFT', label: '임시저장', count: draftCount },
    { key: 'SUBMITTED', label: '평가 완료', count: submittedCount },
  ];
  const filteredTeams = filter === 'ALL'
    ? teams
    : teams.filter((team) => (
        filter === 'NOT_STARTED' ? !team.submissionStatus : team.submissionStatus === filter
      ));

  if (loading)
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );

  if (error)
    return (
      <div className="h-full overflow-auto flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">팀 목록을 불러올 수 없습니다.</p>
        <button
          onClick={() => navigate('/evaluator')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer"
        >
          목록으로 돌아가기
        </button>
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      {/* 상단 네비게이션 바 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center h-12 px-4 gap-3">
        <button
          onClick={() => navigate('/evaluator')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          내 평가
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <span className="text-sm font-semibold text-gray-800">{programTitle || '평가 프로그램'}</span>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <PageHeader
          title={programTitle || '평가 프로그램'}
          subtitle={`평가 기간 ${evaluationPeriod} · 평가할 팀을 선택하거나 완료한 평가를 확인하세요.`}
        >
          {teams.length > 0 && (
            <div className="flex items-center gap-5 px-1">
              <Summary value={submittedCount} label="제출" color="text-green-600" />
              <div className="w-px h-8 bg-gray-100" />
              <Summary value={draftCount} label="임시저장" color="text-amber-500" />
              <div className="w-px h-8 bg-gray-100" />
              <Summary value={notStartedCount} label="미평가" color="text-gray-400" />
            </div>
          )}
        </PageHeader>

        {teams.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400">평가 가능한 팀이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">팀 목록 ({filteredTeams.length})</h2>
              <div className="flex gap-1">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      filter === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-xs ${filter === tab.key ? 'text-blue-100' : 'text-gray-400'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filteredTeams.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400">해당 상태의 팀이 없습니다.</p>
              </div>
            ) : <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">번호</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">팀</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">팀원</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">내 점수</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTeams.map((team) => {
                  const s = statusOf(team);
                  const scored = team.submissionStatus === 'SUBMITTED' || team.submissionStatus === 'DRAFT';
                  const teamIndex = teams.findIndex((item) => item.teamId === team.teamId);
                  return (
                    <tr
                      key={team.teamId}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleSelect(team)}
                    >
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                        #{String(teamIndex + 1).padStart(2, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 text-sm">{team.name}</div>
                        {team.description && (
                          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{team.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {team.memberCount ?? '—'}명
                      </td>
                      <td className="px-6 py-4">
                        {scored ? (
                          <span className="text-sm font-bold text-blue-600">
                            {Number(team.totalScore)} / {Number(team.maxTotalScore)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                            {s.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelect(team); }}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${s.actionStyle}`}
                        >
                          {s.action}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
          </>
        )}
      </div>
    </div>
  );
}

function Summary({ value, label, color }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
