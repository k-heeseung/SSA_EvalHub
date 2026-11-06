import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOpenPrograms } from '../api/programs';
import { getMyApplications, startApplication } from '../api/applications';
import { formatProgramPeriod, scheduleInstant } from '../utils/programSchedule';
import { useApplicationPeriods } from '../query/useApplicationPeriods';
import { getSessionUser } from '../api/auth';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const APP_STATUS = {
  DRAFT: { label: '작성 중', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700', action: '이어서 작성' },
  SUBMITTED: { label: '지원 완료', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700', action: '지원서 보기' },
};

export default function ApplicantHomePage() {
  const navigate = useNavigate();
  const userQuery = useLiveApiQuery(queryKeys.currentUser, () => getSessionUser(), {
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
  const programsQuery = useLiveApiQuery(queryKeys.openPrograms, () => getOpenPrograms());
  const applicationsQuery = useLiveApiQuery(queryKeys.myApplications, () => getMyApplications());
  const { periodFor, currentPeriodFor } = useApplicationPeriods(queryKeys.openPrograms, programsQuery.dataUpdatedAt);
  const user = userQuery.data ?? {};
  const userName = user.name || user.email?.split('@')[0] || '지원자';

  const [actionError, setActionError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const startMutation = useMutation({
    mutationFn: (programId) => startApplication(programId, {}),
  });
  const programs = programsQuery.data ?? [];
  const myApps = applicationsQuery.data ?? [];
  const loading = userQuery.isPending || programsQuery.isPending || applicationsQuery.isPending;
  // 목록 자체를 못 불러온 경우에만 전체 화면 오류로 처리한다.
  // 지원 시작 실패 같은 개별 동작 오류는 목록을 유지한 채 배너로 알린다.
  const fatalError = (programsQuery.isError && applicationsQuery.isError)
    ? '데이터를 불러오지 못했습니다.'
    : '';

  // 프로그램별 내 지원서 (프로그램당 최대 1건)
  const appByProgram = myApps.reduce((acc, app) => {
    acc[app.programId] = app;
    return acc;
  }, {});

  const draftCount = myApps.filter((a) => a.status === 'DRAFT').length;

  // 지원 가능(RECRUITING) 프로그램: 마감 전만 노출. 마감된 지원서는 '내 지원서' 탭에서 확인한다.
  // 이미 지원한(작성 중/지원 완료) 프로그램은 상단에 고정한다. (JS sort는 안정 정렬이라 마감일 순서는 유지된다)
  const visiblePrograms = programs
    .filter((p) => ['RECRUITING', 'SCHEDULED'].includes(p.status) && periodFor(p).canApply)
    .sort((a, b) => (appByProgram[b.id] ? 1 : 0) - (appByProgram[a.id] ? 1 : 0));

  // 접수 예정(SCHEDULED) 프로그램: 아직 지원 불가, 시작일 임박순으로 노출한다.
  const scheduledPrograms = programs
    .filter((p) => ['RECRUITING', 'SCHEDULED'].includes(p.status) && periodFor(p).beforeStart)
    .sort((a, b) => Date.parse(scheduleInstant(a, 'applicationStart')) - Date.parse(scheduleInstant(b, 'applicationStart')));

  const goToApp = (app) =>
    navigate(app.status === 'SUBMITTED'
      ? `/applicant/submissions/${app.applicationId}`
      : `/applicant/apply/${app.applicationId}`);

  const handleStart = async (programId) => {
    if (startMutation.isPending) return;
    const period = currentPeriodFor((programs) => programs?.find((item) => item.id === programId));
    if (!period.canApply) { setActionError(period.blockedMessage || '현재 지원할 수 없는 프로그램입니다.'); return; }
    setActionError('');
    setStartingId(programId);
    try {
      const { data } = await startMutation.mutateAsync(programId);
      navigate(`/applicant/apply/${data.applicationId}`);
    } catch (err) {
      setActionError(err.response?.data?.message || '지원서를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      void programsQuery.refetch();
      setStartingId(null);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-6 py-16 text-center text-gray-400">로딩 중...</div>;
  }

  if (fatalError) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <p className="text-red-500 mb-4">{fatalError}</p>
        {/* 인증 만료(401)는 api 인터셉터가 이미 로그인 화면으로 보내므로, 여기 도달한 오류는 인증 문제가 아니다. */}
        <button
          onClick={() => {
            programsQuery.refetch();
            applicationsQuery.refetch();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {actionError && (
        <div className="mb-6 flex items-start gap-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError('')}
            aria-label="오류 메시지 닫기"
            className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* 웰컴 배너 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
              {userName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-0.5">
                안녕하세요, <span className="text-blue-700">{userName}</span>님
              </h1>
              <p className="text-sm text-gray-600">
                {draftCount > 0 ? (
                  <>작성 중인 지원서 <span className="font-semibold text-gray-900">{draftCount}건</span>이 있습니다. 마감 전에 제출을 완료하세요.</>
                ) : (
                  <>지원 가능한 프로그램을 확인하고 지원서를 작성해 보세요.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 지원 가능한 프로그램 (지원 기간 중 · 이미 지원한 프로그램은 상단 고정) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            지원 가능한 프로그램 <span className="text-gray-400">({visiblePrograms.length})</span>
          </h2>
        </div>
        <hr className="border-t border-gray-200 mb-4" />

        {visiblePrograms.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
            현재 지원 가능한 프로그램이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visiblePrograms.map((program) => {
              const myApp = appByProgram[program.id];
              const status = myApp ? APP_STATUS[myApp.status] : null;
              const dday = periodFor(program).deadlineLabel;
              return (
                <div
                  key={program.id}
                  className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                    myApp ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a4 4 0 100-8 4 4 0 000 8zM8.5 12.5L6 21l6-3 6 3-2.5-8.5" />
                        </svg>
                      </div>
                      {status && (
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${status.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      )}
                    </div>
                    {dday && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">
                        {dday}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1">{program.title}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-1">{program.description || ' '}</p>

                  <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-400">지원 기간</div>
                      <div className="text-sm font-medium text-gray-700">
                        {formatProgramPeriod(program, 'application')}
                      </div>
                    </div>
                    {myApp ? (
                      <button
                        onClick={() => goToApp(myApp)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          myApp.status === 'SUBMITTED'
                            ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            : 'border border-amber-300 text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        {APP_STATUS[myApp.status]?.action || '지원서 보기'} →
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStart(program.id)}
                        disabled={startMutation.isPending || !periodFor(program).canApply}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {startingId === program.id ? '시작 중...' : '지원하기 →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 접수 예정 (SCHEDULED · 아직 지원 불가). 항목이 없어도 메뉴 존재를 알 수 있게 항상 노출한다. */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            접수 예정 <span className="text-gray-400">({scheduledPrograms.length})</span>
          </h2>
        </div>
        <hr className="border-t border-gray-200 mb-4" />
        {scheduledPrograms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scheduledPrograms.map((program) => {
              const startDday = periodFor(program).startLabel;
              return (
                <div key={program.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a4 4 0 100-8 4 4 0 000 8zM8.5 12.5L6 21l6-3 6 3-2.5-8.5" />
                      </svg>
                    </div>
                    {startDday && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200">
                        시작 {startDday}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1">{program.title}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-1">{program.description || ' '}</p>

                  <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-400">지원 기간</div>
                      <div className="text-sm font-medium text-gray-700">
                        {formatProgramPeriod(program, 'application')}
                      </div>
                    </div>
                    <button
                      disabled
                      title="지원 시작 전입니다"
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      접수 예정
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
