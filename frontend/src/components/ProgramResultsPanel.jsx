import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvaluationResults } from '../api/programs';
import { rankedTeams, exportAllTeamsExcel, exportFinalExcel, printResults } from '../utils/export';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const RESULT_STATUS = {
  PASSED:  { label: '합격',   badge: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  FAILED:  { label: '불합격', badge: 'bg-red-50 text-red-600',      dot: 'bg-red-400'   },
  PENDING: { label: '미정',   badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400'  },
};

const FILTER_BUTTONS = [
  { key: 'ALL',     label: '전체' },
  { key: 'PASSED',  label: '합격' },
  { key: 'FAILED',  label: '불합격' },
  { key: 'PENDING', label: '미정' },
];

// 팀 평균 점수를 10점 단위 구간으로 분포화 (점수 분포 차트용).
const SCORE_BUCKETS = [
  { label: '<60', min: 0,  max: 60 },
  { label: '60',  min: 60, max: 70 },
  { label: '70',  min: 70, max: 80 },
  { label: '80',  min: 80, max: 90 },
  { label: '90+', min: 90, max: 101 },
];

// 프로그램 상세 '평가 결과' 탭과 '결과·내보내기' 페이지가 공유하는 결과/내보내기 패널.
export default function ProgramResultsPanel({ programId, program, showTopActions = true }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const { data: results = [], isPending: loading } = useLiveApiQuery(
    queryKeys.evaluationResults(programId),
    () => getEvaluationResults(programId),
  );

  if (loading) return <div className="text-gray-500">로딩 중...</div>;
  if (results.length === 0)
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-400">평가 완료된 팀이 없습니다.</p>
      </div>
    );

  const programTitle = program?.title || '평가 결과';
  const passedCount  = results.filter((r) => r.teamStatus === 'PASSED').length;
  const failedCount  = results.filter((r) => r.teamStatus === 'FAILED').length;
  const pendingCount = results.filter((r) => r.teamStatus === 'PENDING').length;

  const evaluatedTeams = results.filter((r) =>
    r.evaluations.some((e) => e.submission?.status === 'SUBMITTED')
  ).length;
  const completionRate = Math.round((evaluatedTeams / results.length) * 100);

  const allSubmitted = results.flatMap((r) =>
    r.evaluations.filter((e) => e.submission?.status === 'SUBMITTED')
  );
  const avgScore = allSubmitted.length > 0
    ? (allSubmitted.reduce((s, e) => s + Number(e.submission.totalScore), 0) / allSubmitted.length).toFixed(1)
    : '—';

  // 가산점을 쓰는 프로그램이면 심사위원 평균 / 가산점 / 총합을 나눠 보여준다.
  const hasBonus = program?.bonusEnabled || results.some((r) => r.bonusScore != null);

  // 순위 정렬 + 분포 집계 (총합 기준)
  const ranked = rankedTeams(results);
  const buckets = SCORE_BUCKETS.map((b) => ({
    ...b,
    count: ranked.filter((t) => t.final != null && t.final >= b.min && t.final < b.max).length,
  }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const filtered = filter === 'ALL' ? ranked : ranked.filter((r) => r.teamStatus === filter);

  const exportOptions = [
    {
      title: '최종 결과 · 합격자만',
      desc: 'PDF / Excel',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-50 text-green-600',
      onClick: () => exportFinalExcel(programTitle, results),
      onPdf: () => printResults(programTitle, results, { onlyPassed: true }),
    },
    {
      title: '전체팀 평가 정보',
      desc: 'Excel',
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'bg-blue-50 text-blue-600',
      onClick: () => exportAllTeamsExcel(programTitle, results),
    },
    {
      title: '팀 별 상세 정보',
      desc: '개별 PDF · 심사위원 코멘트 포함',
      icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      color: 'bg-purple-50 text-purple-600',
      onClick: () => printResults(programTitle, results),
    },
  ];

  return (
    <div>
      {/* 상단 내보내기 액션 */}
      {showTopActions && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <button
            onClick={() => exportAllTeamsExcel(programTitle, results)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            전체 정보 (Excel)
          </button>
          <button
            onClick={() => printResults(programTitle, results, { onlyPassed: true })}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            최종 결과 내보내기
          </button>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '제출 완료', value: `${completionRate}%`, sub: `${evaluatedTeams}/${results.length} 팀`, color: 'text-green-600' },
          { label: '평균 점수', value: avgScore,             sub: '제출된 평가 기준',                       color: 'text-blue-600'  },
          { label: '합격팀',   value: passedCount,          sub: `불합격 ${failedCount}팀`,                color: 'text-gray-900'  },
          { label: '미정',     value: pendingCount,         sub: '판정 대기 중',                           color: 'text-gray-500'  },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 최종 순위 */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden self-start">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">최종 순위</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{filtered.length}팀</span>
            <div className="flex gap-1 ml-auto">
              {FILTER_BUTTONS.map((btn) => {
                const count =
                  btn.key === 'ALL'     ? results.length :
                  btn.key === 'PASSED'  ? passedCount :
                  btn.key === 'FAILED'  ? failedCount :
                  pendingCount;
                return (
                  <button
                    key={btn.key}
                    onClick={() => setFilter(btn.key)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      filter === btn.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {btn.label}
                    <span className={`text-[11px] px-1 rounded-full ${
                      filter === btn.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">순위</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">팀</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">심사위원별 점수</th>
                {hasBonus ? (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">심사위원 평균</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">가산점</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">총합</th>
                  </>
                ) : (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">최종</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">판정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((team, index) => {
                const statusInfo = RESULT_STATUS[team.teamStatus] ?? RESULT_STATUS.PENDING;
                const submitted  = team.evaluations.filter((e) => e.submission?.status === 'SUBMITTED');
                const rank = filter === 'ALL' ? index + 1 : ranked.findIndex((t) => t.teamId === team.teamId) + 1;

                return (
                  <tr
                    key={team.teamId}
                    onClick={() => navigate(`/admin/programs/${programId}/teams/${team.teamId}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-bold ${
                        rank <= 3 ? 'bg-blue-50 text-blue-600' : 'text-gray-400'
                      }`}>{rank}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900 text-sm">{team.teamName}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {submitted.map((e) => (
                          <span key={e.evaluatorId} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {e.submission.totalScore}
                          </span>
                        ))}
                        {submitted.length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    {hasBonus ? (
                      <>
                        <td className="px-4 py-4 text-sm font-medium text-gray-600">
                          {team.avg != null ? team.avg.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-purple-600">
                          {team.bonusScore != null ? `+${team.bonus}` : '—'}
                        </td>
                        <td className="px-4 py-4 text-base font-bold text-blue-600">
                          {team.final != null ? team.final.toFixed(1) : '—'}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-4 text-base font-bold text-blue-600">
                        {team.final != null ? team.final.toFixed(1) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusInfo.dot}`} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.badge}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 우측: 점수 분포 + 내보내기 옵션 */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">점수 분포</h3>
            <div className="flex items-end justify-between gap-2 h-28">
              {buckets.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-xs font-medium text-gray-500">{b.count > 0 ? b.count : ''}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[11px] text-gray-400">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">내보내기 옵션</h3>
            <p className="text-xs text-gray-400 mb-4">원하는 형식으로 결과를 저장하세요.</p>
            <div className="space-y-2">
              {exportOptions.map((opt) => (
                <button
                  key={opt.title}
                  onClick={opt.onClick}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-left cursor-pointer group"
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${opt.color}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-800">{opt.title}</span>
                    <span className="block text-xs text-gray-400">{opt.desc}</span>
                  </span>
                  {opt.onPdf && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); opt.onPdf(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); opt.onPdf(); } }}
                      className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50"
                      title="PDF로 내보내기"
                    >
                      PDF
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
