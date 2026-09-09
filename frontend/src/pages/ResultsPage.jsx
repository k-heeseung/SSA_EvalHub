import { useNavigate } from 'react-router-dom';
import { getPrograms } from '../api/programs';
import { programTypeLabel } from '../utils/labels';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const STATUS_CONFIG = {
  ACTIVE:   { label: '평가 진행', badge: 'bg-blue-100 text-blue-700' },
  INACTIVE: { label: '완료',     badge: 'bg-green-100 text-green-700' },
};

const formatPeriod = (start, deadline) => {
  if (start && deadline) return `${start} ~ ${deadline}`;
  if (start) return `${start}부터`;
  if (deadline) return `~ ${deadline}`;
  return '미설정';
};

// 좌측 메뉴 '결과·내보내기' 화면. 결과가 존재할 수 있는 프로그램(평가 진행 중/완료)만 모아
// 진행 중인 건 마감 임박 순으로, 완료된 건 최근 종료 순으로 보여준다. 카드를 누르면 해당
// 프로그램 상세의 '평가 결과' 탭(ProgramResultsPanel)으로 바로 이동한다.
export default function ResultsPage() {
  const navigate = useNavigate();
  const { data: allPrograms = [], isPending: loading } = useLiveApiQuery(
    queryKeys.programs,
    () => getPrograms(),
  );

  const deadlineTime = (p) => {
    const t = p.evaluationDeadline ? new Date(p.evaluationDeadline).getTime() : null;
    return Number.isFinite(t) ? t : null;
  };

  const programs = allPrograms
    .filter((p) => p.status === 'ACTIVE' || p.status === 'INACTIVE')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
      const at = deadlineTime(a);
      const bt = deadlineTime(b);
      if (at == null && bt == null) return 0;
      if (at == null) return 1;
      if (bt == null) return -1;
      // 진행 중: 마감 임박(오름차순) 순 · 완료: 최근 종료(내림차순) 순
      return a.status === 'ACTIVE' ? at - bt : bt - at;
    });

  const goToResults = (programId) =>
    navigate(`/admin/programs/${programId}`, {
      state: { defaultTab: 3, back: { path: '/admin/results', label: '결과·내보내기' } },
    });

  return (
    <div className="p-8">
      <PageHeader
        breadcrumb={['EvalHub', '결과·내보내기']}
        title="평가 결과"
        subtitle="평가가 진행 중이거나 완료된 프로그램만 모았습니다. 진행 중인 순서대로 우선 확인하세요."
      />

      {loading ? (
        <div className="text-gray-500">로딩 중...</div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">결과를 확인할 수 있는 프로그램이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((program) => (
            <ResultProgramCard
              key={program.id}
              program={program}
              onClick={() => goToResults(program.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultProgramCard({ program, onClick }) {
  const status = STATUS_CONFIG[program.status] ?? STATUS_CONFIG.ACTIVE;
  const evalRate = program.evaluatorCount
    ? Math.round((program.submittedCount / program.evaluatorCount) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base">{program.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.badge}`}>
              {status.label}
            </span>
          </div>
          <span className="text-xs text-gray-500">{programTypeLabel(program.type)}</span>
        </div>
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/60 px-3 py-2.5 mb-4">
        <p className="text-xs text-blue-500 mb-1">평가 기간</p>
        <p className="text-sm font-medium text-gray-700">
          {formatPeriod(program.evaluationStart, program.evaluationDeadline)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-1">지원 팀</p>
          <p className="text-xl font-bold text-gray-900">{program.teamCount ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">심사위원</p>
          <p className="text-xl font-bold text-gray-900">{program.evaluatorCount ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">평가율</p>
          <p className={`text-xl font-bold ${evalRate === 100 ? 'text-green-600' : 'text-blue-600'}`}>
            {evalRate}%
          </p>
        </div>
      </div>
    </div>
  );
}
