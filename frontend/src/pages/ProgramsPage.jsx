import { useState, useEffect, useRef, useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPrograms, deleteProgram } from '../api/programs';
import { programTypeLabel } from '../utils/labels';
import PageHeader from '../components/PageHeader';
import { formatProgramPeriod, nextProgramDeadline, matchesDeadlineMonth } from '../utils/programSchedule';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { useScheduleNow } from '../query/useScheduleNow';
import './ProgramsPage.css';

const STATUS_CONFIG = {
  DRAFT:      { label: '임시 저장', badge: 'bg-gray-100 text-gray-600' },
  SCHEDULED:  { label: '접수 예정', badge: 'bg-violet-100 text-violet-700' },
  RECRUITING: { label: '지원 접수', badge: 'bg-orange-100 text-orange-700' },
  PENDING_EVALUATION: { label: '평가 대기', badge: 'bg-sky-100 text-sky-700' },
  ACTIVE:     { label: '평가 진행', badge: 'bg-blue-100 text-blue-700' },
  INACTIVE:   { label: '완료',     badge: 'bg-green-100 text-green-700' },
};



const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);

const DEADLINE_LABELS = { THIS_MONTH: '이번 달 마감', NEXT_MONTH: '다음 달 이내 마감' };

function usePopover(open, setOpen, containerRef, triggerRef) {
  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector('[data-popover] button')?.focus();
    const dismissOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    containerRef.current?.addEventListener('keydown', dismissEscape);
    const container = containerRef.current;
    return () => {
      document.removeEventListener('mousedown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      container?.removeEventListener('keydown', dismissEscape);
    };
  }, [open, setOpen, containerRef, triggerRef]);
}

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [filterDeadline, setFilterDeadline] = useState('ALL');
  const [tempType, setTempType] = useState('ALL');
  const [tempDeadline, setTempDeadline] = useState('ALL');
  const filterRef = useRef(null);
  const filterTriggerRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const filterId = useId();
  const navigate = useNavigate();
  const { data: rawPrograms = [], isPending: loading, isError, isFetching, refetch } = useLiveApiQuery(
    queryKeys.programs,
    () => getPrograms(),
  );
  const deleteMutation = useMutation({ mutationFn: deleteProgram });

  // 완료(INACTIVE)된 프로그램은 맨 아래로, 나머지는 임박한 마감(지원 마감 또는 평가 마감 중 더 가까운 쪽) 순으로 정렬한다.
  const now = useScheduleNow();
  const programs = [...rawPrograms].sort((a, b) => {
    const aDone = a.status === 'INACTIVE';
    const bDone = b.status === 'INACTIVE';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return nextProgramDeadline(a, now) - nextProgramDeadline(b, now);
  });

  usePopover(filterOpen, setFilterOpen, filterRef, filterTriggerRef);

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteTarget(null); },
    });
  };

  const matchingPrograms = programs.filter((program) =>
    (filterType === 'ALL' || program.type === filterType)
    && matchesDeadlineMonth(program, filterDeadline, new Date(now)));
  const filteredPrograms = matchingPrograms.filter((program) => activeTab === 'ALL' || program.status === activeTab);

  const isFiltered = filterType !== 'ALL' || filterDeadline !== 'ALL';

  const tabs = [
    { key: 'ALL', label: '전체', count: matchingPrograms.length },
    ...Object.entries(STATUS_CONFIG).map(([key, { label }]) => ({
      key, label, count: matchingPrograms.filter((program) => program.status === key).length,
    })),
  ];
  const clearFilters = () => {
    setFilterType('ALL');
    setFilterDeadline('ALL');
    setTempType('ALL');
    setTempDeadline('ALL');
    filterTriggerRef.current?.focus();
  };

  return (
    <div className="programs-page p-8 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-blue-600">
      {/* 헤더 */}
      <PageHeader
        className="programs-header"
        breadcrumb={['평가ON', '프로그램']}
        title="프로그램"
        subtitle="지원 접수·평가·집계를 관리할 프로그램을 개설하고 운영합니다."
      >
        <div className="programs-header-actions flex items-center gap-2">
          <div className="programs-filter-anchor relative" ref={filterRef}>
            <button
              ref={filterTriggerRef}
              aria-expanded={filterOpen}
              aria-controls={filterOpen ? filterId : undefined}
              aria-haspopup="dialog"
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
              <div id={filterId} role="dialog" aria-label="프로그램 필터" data-popover className="programs-filter-popover absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-4 space-y-4">
                {/* 유형 */}
                <div>
                  <p className="programs-label font-semibold text-gray-600 mb-2">프로그램 유형</p>
                  <div className="space-y-1">
                    {[
                      { key: 'ALL', label: '전체' },
                      { key: 'MODULE_A', label: '프로그램 지원/심사 시스템' },
                      { key: 'MODULE_B', label: '팀/프로젝트 평가' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        aria-pressed={tempType === opt.key}
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
                  <p className="programs-label font-semibold text-gray-600 mb-2">지원 마감</p>
                  <div className="space-y-1">
                    {[
                      { key: 'ALL', label: '전체' },
                      { key: 'THIS_MONTH', label: '이번 달 마감' },
                      { key: 'NEXT_MONTH', label: '다음 달 이내 마감' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        aria-pressed={tempDeadline === opt.key}
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
                    className="flex-1 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer transition-colors"
                  >
                    선택 초기화
                  </button>
                  <button
                    onClick={() => { setFilterType(tempType); setFilterDeadline(tempDeadline); setFilterOpen(false); filterTriggerRef.current?.focus(); }}
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

      <section className="programs-workspace" aria-label="프로그램 목록">
      {/* 탭 */}
      <div role="group" aria-label="프로그램 상태" className="programs-status-tabs flex flex-wrap gap-0 border-b border-gray-200 mb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            aria-pressed={activeTab === tab.key}
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
              {isError && rawPrograms.length === 0 ? '—' : tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="programs-workspace-content">
      <div className="programs-results-toolbar flex flex-wrap items-center gap-2 mb-2 text-sm">
        <p id="programs-results-summary" tabIndex={-1} role="status" className="text-gray-600 mr-2">
          {loading ? '프로그램을 불러오는 중입니다.' : isError && rawPrograms.length === 0 ? '목록을 확인할 수 없습니다.' : `${filteredPrograms.length}개 표시`}
        </p>
        {filterType !== 'ALL' && (
          <button onClick={() => { setFilterType('ALL'); filterTriggerRef.current?.focus(); }} aria-label={`${programTypeLabel(filterType)} 필터 해제`} className="rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 hover:bg-blue-100 cursor-pointer">
            {programTypeLabel(filterType)} <span aria-hidden="true">×</span>
          </button>
        )}
        {filterDeadline !== 'ALL' && (
          <button onClick={() => { setFilterDeadline('ALL'); filterTriggerRef.current?.focus(); }} aria-label={`${DEADLINE_LABELS[filterDeadline]} 필터 해제`} className="rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 hover:bg-blue-100 cursor-pointer">
            {DEADLINE_LABELS[filterDeadline]} <span aria-hidden="true">×</span>
          </button>
        )}
        {isFiltered && <button onClick={clearFilters} className="px-2 py-1.5 text-gray-600 underline underline-offset-4 hover:text-gray-900 cursor-pointer">전체 해제</button>}
      </div>

      {isError && (
        <div role="alert" className="mb-2 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{rawPrograms.length > 0 ? '최신 프로그램 목록을 불러오지 못했습니다. 이전에 불러온 내용을 표시합니다.' : '프로그램 목록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.'}</p>
          <button onClick={() => refetch()} disabled={isFetching} className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-medium hover:bg-red-100 disabled:opacity-50 cursor-pointer">{isFetching ? '다시 불러오는 중…' : '다시 시도'}</button>
        </div>
      )}

      {/* 프로그램 목록 */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">로딩 중...</div>
      ) : isError && programs.length === 0 ? null : programs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          </div>
          <p className="programs-empty-title text-gray-700 font-semibold text-lg mb-1">등록된 프로그램이 없습니다</p>
          <p className="text-gray-500 text-sm mb-6">첫 번째 프로그램을 개설해 평가를 시작하세요.</p>
          <button
            onClick={() => navigate('/admin/programs/new')}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 프로그램 생성
          </button>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">해당하는 프로그램이 없습니다.</p>
          {(isFiltered || activeTab !== 'ALL') && <button onClick={() => { clearFilters(); setActiveTab('ALL'); }} className="mt-3 text-sm text-blue-700 underline underline-offset-4 cursor-pointer">모든 프로그램 보기</button>}
        </div>
      ) : (
        <div className="programs-grid grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onManage={() => navigate(`/admin/programs/${program.id}`)}
              onEdit={() => navigate(`/admin/programs/${program.id}/edit`)}
              onContinue={() => navigate('/admin/programs/new', { state: { loadDraftId: program.id } })}
              onDelete={(trigger) => { deleteTriggerRef.current = trigger; deleteMutation.reset(); setDeleteTarget(program); }}
            />
          ))}
        </div>
      )}

      </div>
      </section>

      {deleteTarget !== null && (
        <ConfirmDeleteModal
          program={deleteTarget}
          pending={deleteMutation.isPending}
          error={deleteMutation.isError}
          returnFocusRef={deleteTriggerRef}
          onCancel={() => { if (!deleteMutation.isPending) setDeleteTarget(null); }}
          onConfirm={handleDelete}
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
  const menuTriggerRef = useRef(null);
  const menuId = useId();
  usePopover(menuOpen, setMenuOpen, menuRef, menuTriggerRef);

  const evalRate = isDraft || !program.evaluatorCount
    ? 0
    : Math.round((program.submittedCount / program.evaluatorCount) * 100);
  const barColor = isDraft ? 'bg-gray-300' : evalRate === 100 ? 'bg-green-500' : 'bg-blue-500';
  const barWidth = `${isDraft ? 0 : evalRate}%`;

  return (
    <div className="programs-card bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 카드 본문 */}
      <div className="programs-card-body p-5">
        {/* 헤더 */}
        <div className="programs-card-heading flex items-start justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h3 className="programs-card-title text-gray-900">{program.title}</h3>
                <span className={`programs-label px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.badge}`}>
                  {status.label}
                </span>
              </div>
              <div className="programs-metadata flex flex-wrap items-center gap-x-1.5 text-gray-600">
                <span>{programTypeLabel(program.type)}</span>
              </div>
            </div>
          </div>

          {/*··· 드롭다운 */}
          <div className="relative flex-shrink-0 ml-2" ref={menuRef}>
            <button
              ref={menuTriggerRef}
              aria-label={`${program.title} 추가 작업`}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="text-gray-600 hover:text-gray-900 text-lg leading-none cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ···
            </button>
            {menuOpen && (
              <div id={menuId} role="group" aria-label={`${program.title} 작업`} data-popover className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                {!isDraft && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    수정
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(menuTriggerRef.current); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="programs-periods grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="programs-label text-gray-600 mb-1">지원 기간</p>
            <p className="programs-period text-gray-800">
              {formatProgramPeriod(program, 'application')}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50/60 px-3 py-2.5">
            <p className="programs-label text-blue-700 mb-1">평가 기간</p>
            <p className="programs-period text-gray-800">
              {formatProgramPeriod(program, 'evaluation')}
            </p>
          </div>
        </div>

        <div className="programs-card-summary">
        <div className="programs-card-metrics grid grid-cols-3 gap-2 mb-4">
          <div>
            <p className="programs-label text-gray-600 mb-1">지원 팀</p>
            <p className="programs-metric text-gray-900">{program.teamCount ?? '-'}</p>
          </div>
          <div>
            <p className="programs-label text-gray-600 mb-1">심사위원</p>
            <p className="programs-metric text-gray-900">{program.evaluatorCount ?? '-'}</p>
          </div>
          <div>
            <p className="programs-label text-gray-600 mb-1">평가율</p>
            <p className={`programs-metric ${evalRate === 100 ? 'text-green-700' : 'text-blue-700'}`}>
              {isDraft ? '-' : `${evalRate}%`}
            </p>
          </div>
        </div>

        <button
          aria-label={`${program.title} ${isDraft ? '이어서 작성' : '관리'}`}
          onClick={isDraft ? onContinue : onManage}
          className="programs-manage-button px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          {isDraft ? '이어서 작성' : '관리'}
        </button>
        </div>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-100 rounded-full h-1">
          <div className={`h-1 rounded-full ${barColor}`} style={{ width: barWidth }} />
        </div>
      </div>

    </div>
  );
}

function ConfirmDeleteModal({ program, pending, error, returnFocusRef, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = returnFocusRef.current;
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    return () => {
      dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus();
      else document.getElementById('programs-results-summary')?.focus();
    };
  }, [returnFocusRef]);

  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

  return (
    <dialog ref={dialogRef} tabIndex={-1} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first) { event.preventDefault(); dialogRef.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }}
      className="programs-delete-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-blue-600">
        <h2 id={titleId} className="text-lg font-semibold text-gray-800 mb-2">프로그램 삭제</h2>
        <p className="text-sm font-medium text-gray-900 break-words mb-2">{program.title}</p>
        <p id={descriptionId} className="text-sm text-gray-600 mb-6">
          해당 프로그램과 하위 팀, 질문, 배정이 모두 삭제됩니다. 계속하시겠습니까?
        </p>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">프로그램을 삭제하지 못했습니다. 연결 상태와 권한을 확인한 뒤 다시 시도해주세요.</p>}
        <p role="status" className={pending ? 'mb-4 text-sm text-gray-600' : 'sr-only'}>{pending ? '프로그램을 삭제하고 있습니다. 잠시 기다려주세요.' : ''}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {pending ? '삭제 중…' : error ? '삭제 다시 시도' : '삭제'}
          </button>
        </div>
    </dialog>
  );
}
