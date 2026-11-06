import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPrograms, getTeams, getEvaluationResults } from '../api/programs';
import { programTypeLabel } from '../utils/labels';
import { teamAverage, teamBonus, teamFinalScore } from '../utils/export';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { LIVE_REFETCH_INTERVAL, useLiveApiQuery } from '../query/useApiQuery';

const TEAM_STATUS = {
  PENDING: { label: '평가 전', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  PASSED:  { label: '합격',   dot: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  FAILED:  { label: '불합격', dot: 'bg-red-400',   badge: 'bg-red-50 text-red-600' },
};

export default function TeamsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [collapsed, setCollapsed] = useState({});

  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const programs = (programsQuery.data ?? []).filter((program) => program.status !== 'DRAFT');
  const teamQueries = useQueries({
    queries: programs.map((program) => ({
      queryKey: queryKeys.teams(program.id),
      queryFn: async () => (await getTeams(program.id)).data,
      staleTime: 15_000,
      refetchInterval: LIVE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    })),
  });
  const resultQueries = useQueries({
    queries: programs.map((program) => ({
      queryKey: queryKeys.evaluationResults(program.id),
      queryFn: async () => (await getEvaluationResults(program.id)).data,
      staleTime: 15_000,
      refetchInterval: LIVE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    })),
  });
  const programsWithTeams = programs.map((program, index) => {
    const results = resultQueries[index]?.data ?? [];
    const resultByTeam = new Map(results.map((result) => [result.teamId, result]));
    return {
      ...program,
      hasBonus: program.bonusEnabled || results.some((result) => result.bonusScore != null),
      teams: (teamQueries[index]?.data ?? []).map((team) => {
        const result = resultByTeam.get(team.teamId);
        const scoreResult = {
          evaluations: result?.evaluations ?? [],
          bonusScore: result?.bonusScore ?? team.bonusScore ?? null,
        };
        return {
          ...team,
          averageScore: teamAverage(scoreResult),
          bonusScore: scoreResult.bonusScore,
          bonus: teamBonus(scoreResult),
          totalScore: teamFinalScore(scoreResult),
        };
      }),
    };
  });
  const loading = programsQuery.isPending
    || teamQueries.some((query) => query.isPending)
    || resultQueries.some((query) => query.isPending);

  const toggleCollapse = (programId) => {
    setCollapsed((prev) => ({ ...prev, [programId]: !prev[programId] }));
  };

  const totalTeams = programsWithTeams.reduce((s, p) => s + p.teams.length, 0);

  const filterButtons = [
    { key: 'ALL', label: '전체' },
    { key: 'PENDING', label: '평가 전' },
    { key: 'FINISHED', label: '평가 완료' },
  ];

  const filteredPrograms = programsWithTeams
    .map((p) => ({
      ...p,
      teams: p.teams.filter((t) => {
        if (filter === 'FINISHED') {
          if (t.status !== 'PASSED' && t.status !== 'FAILED') return false;
        } else if (filter !== 'ALL' && t.status !== filter) {
          return false;
        }
        if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    }))
    .filter((p) => p.teams.length > 0 || (!search && filter === 'ALL'));

  if (loading) return <div className="p-8 text-gray-500">로딩 중...</div>;

  return (
    <div className="p-8">
      {/* 헤더 */}
      <PageHeader
        breadcrumb={['EvalHub', '팀 관리']}
        title="팀 관리"
        subtitle="전체 프로그램의 팀을 조회하고 관리합니다."
      >
      </PageHeader>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="팀명 검색…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-56"
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
      </div>

      {/* 프로그램별 팀 목록 */}
      {filteredPrograms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          조건에 맞는 팀이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrograms.map((program) => (
            <div key={program.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 프로그램 헤더 */}
              <button
                onClick={() => toggleCollapse(program.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3h14M5 3a2 2 0 00-2 2v3a7 7 0 007 7m-5-10h10m0 0a2 2 0 012 2v3a7 7 0 01-7 7m0 0v3m0 0h-4m4 0h4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{program.title}</span>
                      <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {programTypeLabel(program.type)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        program.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {program.status === 'ACTIVE' ? '진행 중' : '완료'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {program.teams.length}팀
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${collapsed[program.id] ? '-rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* 팀 테이블 */}
              {!collapsed[program.id] && (
                program.teams.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm border-t border-gray-100">
                    등록된 팀이 없습니다.
                  </div>
                ) : (
                  <table className="w-full border-t border-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">팀명</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">팀원</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">제출물</th>
                        {program.hasBonus ? (
                          <>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">심사위원 평균</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">가산점</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">총합</th>
                          </>
                        ) : (
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">심사위원 평균</th>
                        )}
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {program.teams.map((team) => {
                        const s = TEAM_STATUS[team.status] || TEAM_STATUS.PENDING;
                        const hasSub = team.submissionCount > 0 || Boolean(team.applicantInfo?.name);
                        return (
                          <tr
                            key={team.teamId}
                            onClick={() => navigate(`/admin/programs/${program.id}/teams/${team.teamId}`)}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-gray-900 text-sm">{team.name}</div>
                              {team.description && (
                                <div className="text-xs text-gray-400 line-clamp-1">{team.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-600">
                              {team.participantType === 'TEAM' ? `${team.memberCount}명` : '개인'}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {hasSub ? '제출됨' : '미제출'}
                              </span>
                            </td>
                            {program.hasBonus ? (
                              <>
                                <td className="px-4 py-3.5 text-sm font-medium text-gray-600">
                                  {team.averageScore == null ? '—' : team.averageScore.toFixed(1)}
                                </td>
                                <td className="px-4 py-3.5 text-sm font-medium text-purple-600">
                                  {team.bonusScore != null ? `+${team.bonus}` : '—'}
                                </td>
                                <td className="px-4 py-3.5 text-sm font-bold text-blue-600">
                                  {team.totalScore == null ? '—' : team.totalScore.toFixed(1)}
                                </td>
                              </>
                            ) : (
                              <td className="px-4 py-3.5 text-sm font-semibold text-gray-700">
                                {team.averageScore == null ? '—' : team.averageScore.toFixed(1)}
                              </td>
                            )}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                                  {s.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
