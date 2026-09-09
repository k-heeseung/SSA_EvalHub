import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPrograms, deleteProgram } from '../api/programs';
import { programTypeLabel } from '../utils/labels';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const STATUS_CONFIG = {
  DRAFT:      { label: '임시 저장', badge: 'bg-gray-100 text-gray-500' },
  SCHEDULED:  { label: '접수 예정', badge: 'bg-violet-100 text-violet-700' },
  RECRUITING: { label: '지원 접수', badge: 'bg-orange-100 text-orange-600' },
  ACTIVE:     { label: '평가 진행', badge: 'bg-blue-100 text-blue-700' },
  INACTIVE:   { label: '완료',     badge: 'bg-green-100 text-green-700' },
};

const formatPeriod = (start, deadline) => {
  if (start && deadline) return `${start} ~ ${deadline}`;
  if (start) return `${start}부터`;
  if (deadline) return `~ ${deadline}`;
  return '미설정';
};

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [filterDeadline, setFilterDeadline] = useState('ALL');
  const [tempType, setTempType] = useState('ALL');
  const [tempDeadline, setTempDeadline] = useState('ALL');
  const filterRef = useRef(null);
  const navigate = useNavigate();
  const { data: rawPrograms = [], isPending: loading } = useLiveApiQuery(
    queryKeys.programs,
    () => getPrograms(),
  );
  const deleteMutation = useMutation({ mutationFn: deleteProgram });

  // 완료(INACTIVE)된 프로그램은 맨 아래로, 나머지는 임박한 마감(지원 마감 또는 평가 마감 중 더 가까운 쪽) 순으로 정렬한다.
  const nextDeadlineTime = (p) => {
    const now = new Date().getTime();
    const times = [p.applicationDeadline, p.evaluationDeadline]
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    const upcoming = times.filter((t) => t >= now);
    if (upcoming.length > 0) return Math.min(...upcoming);
    return times.length > 0 ? Math.min(...times) : Infinity;
  };
  const programs = [...rawPrograms].sort((a, b) => {
    const aDone = a.status === 'INACTIVE';
    const bDone = b.status === 'INACTIVE';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return nextDeadlineTime(a) - nextDeadlineTime(b);
  });

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const handleDelete = (id) => {
    deleteMutation.mutateAsync(id)
      .then(() => { setDeleteTargetId(null); })
      .catch(console.error);
  };

  const draftPrograms      = programs.filter((p) => p.status === 'DRAFT');
  const scheduledPrograms  = programs.filter((p) => p.status === 'SCHEDULED');
  const recruitingPrograms = programs.filter((p) => p.status === 'RECRUITING');
  const activePrograms     = programs.filter((p) => p.status === 'ACTIVE');
  const inactivePrograms   = programs.filter((p) => p.status === 'INACTIVE');

  const byTab =
    activeTab === 'ALL'        ? programs :
    activeTab === 'DRAFT'      ? draftPrograms :
    activeTab === 'SCHEDULED'  ? scheduledPrograms :
    activeTab === 'RECRUITING' ? recruitingPrograms :
    activeTab === 'ACTIVE'     ? activePrograms :
    inactivePrograms;

  const now = new Date();
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const filteredPrograms = byTab.filter((p) => {
    if (filterType !== 'ALL' && p.type !== filterType) return false;
    if (filterDeadline !== 'ALL' && p.applicationDeadline) {
      const d = new Date(p.applicationDeadline);
      if (filterDeadline === 'THIS_MONTH' && d > thisMonthEnd) return false;
      if (filterDeadline === 'NEXT_MONTH' && d > nextMonthEnd) return false;
    }
    return true;
  });

  const isFiltered = filterType !== 'ALL' || filterDeadline !== 'ALL';

  const tabs = [
    { key: 'ALL',        label: '전체',     count: programs.length },
    { key: 'DRAFT',      label: '임시 저장', count: draftPrograms.length },
    { key: 'SCHEDULED',  label: '접수 예정', count: scheduledPrograms.length },
    { key: 'RECRUITING', label: '모집 중',   count: recruitingPrograms.length },
    { key: 'ACTIVE',     label: '진행 중',   count: activePrograms.length },
    { key: 'INACTIVE',   label: '완료',     count: inactivePrograms.length },
  ];

  return (
    <div className="p-8">
      {/* 헤더 */}
      <PageHeader
        breadcrumb={['EvalHub', '프로그램']}
        title="프로그램"
        subtitle="지원 접수·평가·집계를 관리할 프로그램을 개설하고 운영합니다."
      >
        <div className="flex items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => { setTempType(filterType); setTempDeadline(filterDeadline); setFilterOpen((v) => !v); }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors cursor-pointer ${
                isFiltered
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FilterIcon />
              필터{isFiltered && ' · 적용 중'}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-4 space-y-4">
                {/* 유형 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">프로그램 유형</p>
                  <div className="space-y-1">
                    {[
                      { key: 'ALL', label: '전체' },
                      { key: 'MODULE_A', label: '프로그램 지원/심사 시스템' },
                      { key: 'MODULE_B', label: '팀/프로젝트 평가' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTempType(opt.key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          tempType === opt.key
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 마감일 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">지원 마감</p>
                  <div className="space-y-1">
                    {[
                      { key: 'ALL', label: '전체' },
                      { key: 'THIS_MONTH', label: '이번 달 마감' },
                      { key: 'NEXT_MONTH', label: '다음 달 이내 마감' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTempDeadline(opt.key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          tempDeadline === opt.key
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 하단 버튼 */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { setTempType('ALL'); setTempDeadline('ALL'); }}
                    className="flex-1 py-1.5 text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                  >
                    초기화
                  </button>
                  <button
                    onClick={() => { setFilterType(tempType); setFilterDeadline(tempDeadline); setFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    적용
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/programs/new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 프로그램 생성
          </button>
        </div>
      </PageHeader>

      {/* 탭 */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 프로그램 목록 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">로딩 중...</div>
      ) : programs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          </div>
          <p className="text-gray-700 font-semibold text-lg mb-1">등록된 프로그램이 없습니다</p>
          <p className="text-gray-400 text-sm mb-6">첫 번째 프로그램을 개설해 평가를 시작하세요.</p>
          <button
            onClick={() => navigate('/admin/programs/new')}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 프로그램 생성
          </button>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">해당하는 프로그램이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onManage={() => navigate(`/admin/programs/${program.id}`)}
              onEdit={() => navigate(`/admin/programs/${program.id}/edit`)}
              onContinue={() => navigate('/admin/programs/new', { state: { loadDraftId: program.id } })}
              onDelete={() => setDeleteTargetId(program.id)}
            />
          ))}
        </div>
      )}

      {deleteTargetId !== null && (
        <ConfirmDeleteModal
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => handleDelete(deleteTargetId)}
        />
      )}
    </div>
  );
}

function ProgramCard({ program, onManage, onEdit, onContinue, onDelete }) {
  const status = STATUS_CONFIG[program.status] || STATUS_CONFIG.INACTIVE;
  const isDraft = program.status === 'DRAFT';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const evalRate = isDraft || !program.evaluatorCount
    ? 0
    : Math.round((program.submittedCount / program.evaluatorCount) * 100);
  const barColor = isDraft ? 'bg-gray-300' : evalRate === 100 ? 'bg-green-500' : 'bg-blue-500';
  const barWidth = `${isDraft ? 0 : evalRate}%`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 카드 본문 */}
      <div className="p-5">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h3 className="font-bold text-gray-900 text-base">{program.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.badge}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="text-xs text-gray-500">{programTypeLabel(program.type)}</span>
                {program.eligibilityCriteria && (
                  <>
                    <span>·</span>
                    <span className="truncate">{program.eligibilityCriteria}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/*··· 드롭다운 */}
          <div className="relative flex-shrink-0 ml-2" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="text-gray-300 hover:text-gray-500 text-lg leading-none cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ···
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                {!isDraft && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    수정
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-1">지원 기간</p>
            <p className="text-sm font-medium text-gray-700">
              {formatPeriod(program.applicationStart, program.applicationDeadline)}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50/60 px-3 py-2.5">
            <p className="text-xs text-blue-500 mb-1">평가 기간</p>
            <p className="text-sm font-medium text-gray-700">
              {formatPeriod(program.evaluationStart, program.evaluationDeadline)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
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
              {isDraft ? '-' : `${evalRate}%`}
            </p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-100 rounded-full h-1">
          <div className={`h-1 rounded-full ${barColor}`} style={{ width: barWidth }} />
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
        <button
          onClick={isDraft ? onContinue : onManage}
          className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          {isDraft ? '이어서 작성' : '관리'}
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">프로그램 삭제</h2>
        <p className="text-sm text-gray-500 mb-6">
          해당 프로그램과 하위 팀, 질문, 배정이 모두 삭제됩니다. 계속하시겠습니까?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
