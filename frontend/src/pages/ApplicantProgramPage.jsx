import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { getOpenPrograms } from '../api/programs';
import { getMyApplications, startApplication } from '../api/applications';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { useApplicationPeriods } from '../query/useApplicationPeriods';
import { formatProgramPeriod } from '../utils/programSchedule';
import ApplicantProgramInfo from '../components/ApplicantProgramInfo';
import ApplicantQueryNotice from '../components/ApplicantQueryNotice';

export default function ApplicantProgramPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const [actionError, setActionError] = useState('');
  const programsQuery = useLiveApiQuery(queryKeys.openPrograms, () => getOpenPrograms());
  const applicationsQuery = useLiveApiQuery(queryKeys.myApplications, () => getMyApplications());
  const { periodFor, currentPeriodFor } = useApplicationPeriods(queryKeys.openPrograms, programsQuery.dataUpdatedAt);
  const program = programsQuery.data?.find(item => String(item.id) === programId);
  const applicationsReady = applicationsQuery.isSuccess;
  const myApp = applicationsReady ? applicationsQuery.data?.find(item => String(item.programId) === programId) : null;
  const period = periodFor(program);
  const startMutation = useMutation({ mutationFn: () => startApplication(program.id, {}) });
  useEffect(() => {
    if (program?.id) { headingRef.current?.focus(); window.scrollTo(0, 0); }
  }, [program?.id]);

  const handleApply = async () => {
    if (!programsQuery.isSuccess || !applicationsReady || startMutation.isPending) return;
    if (myApp) {
      navigate(myApp.status === 'SUBMITTED' ? `/applicant/submissions/${myApp.applicationId}` : `/applicant/apply/${myApp.applicationId}`);
      return;
    }
    const latestPeriod = currentPeriodFor(items => items?.find(item => String(item.id) === programId));
    if (!latestPeriod.canApply) { setActionError('현재 지원할 수 없습니다. 지원 기간을 확인해 주세요.'); return; }
    setActionError('');
    try {
      const { data } = await startMutation.mutateAsync();
      navigate(`/applicant/apply/${data.applicationId}`);
    } catch (error) {
      setActionError(error.response?.data?.message || '지원서를 시작하지 못했습니다. 다시 시도해 주세요.');
      void programsQuery.refetch();
      void applicationsQuery.refetch();
    }
  };

  return (
    <div className="ui-page max-w-6xl">
      <Link to="/applicant" className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-blue-700">← 프로그램 목록으로</Link>
      <ApplicantQueryNotice query={programsQuery} label="프로그램 목록" detail="프로그램 안내를 확인할 수 없습니다." />
      {programsQuery.isSuccess && !program && (
        <div className="ui-card" role="status">
          <h1 className="ui-page-title">프로그램 안내를 확인할 수 없습니다.</h1>
          <p className="mt-3 text-gray-600">현재 공개된 접수 예정·접수 중 프로그램에서 찾을 수 없습니다. 기존 지원서는 내 지원서에서 확인해 주세요.</p>
          <Link to="/applicant/submissions" className="ui-button mt-4 inline-flex items-center">내 지원서 보기</Link>
        </div>
      )}
      {programsQuery.isSuccess && program && <>
        <header className="mb-2">
          <h1 ref={headingRef} tabIndex={-1} className="ui-page-title text-gray-900">{program.title}</h1>
          <p className="mt-3 text-sm font-medium text-blue-700">{period.label}</p>
          <a href="#program-application" className="mt-3 inline-flex min-h-11 items-center text-sm text-blue-700 lg:hidden">지원 안내로 이동 ↓</a>
        </header>
        <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ApplicantProgramInfo program={program} />
          <aside id="program-application" aria-labelledby="program-application-title" className="ui-card min-w-0 scroll-mt-6">
            <h2 id="program-application-title" className="mb-5 text-xl font-semibold text-gray-900">지원 안내</h2>
            <dl className="mb-6 space-y-4">
              <div><dt className="mb-1 text-sm text-gray-500">지원 기간</dt><dd className="text-base leading-relaxed text-gray-900">{formatProgramPeriod(program, 'application')}</dd></div>
              <div><dt className="mb-1 text-sm text-gray-500">내 지원 상태</dt><dd className="text-base font-medium text-gray-900">{!applicationsReady ? (applicationsQuery.isError ? '지원 여부 확인 불가' : '지원 여부 확인 중') : myApp?.status === 'SUBMITTED' ? '지원 완료' : myApp ? '작성 중' : '지원 전'}</dd></div>
            </dl>
            <ApplicantQueryNotice query={applicationsQuery} label="내 지원서" detail="지원 여부를 확인할 수 없어 새 지원을 시작할 수 없습니다." />
            {actionError && <p role="alert" className="mb-4 text-sm text-red-700">{actionError}</p>}
            <button type="button" onClick={handleApply} disabled={!applicationsReady || startMutation.isPending || (!myApp && !period.canApply)}
              aria-busy={startMutation.isPending} className="ui-button ui-button--primary w-full">
              {!applicationsReady ? (applicationsQuery.isError ? '지원 여부 확인 불가' : '지원 여부 확인 중...') : startMutation.isPending ? '시작 중...' : myApp?.status === 'SUBMITTED' ? '지원서 보기' : myApp ? '이어서 작성' : period.beforeStart ? '접수 예정' : !period.canApply ? '지원 마감' : '지원서 작성 시작'}
            </button>
            {applicationsReady && !myApp && period.canApply && <p className="mt-3 text-sm leading-relaxed text-gray-500">버튼을 누르면 지원서 초안이 생성됩니다. 작성 후 최종 제출을 완료해 주세요.</p>}
            {period.beforeStart && <p className="mt-3 text-sm leading-relaxed text-gray-500">접수가 시작되면 지원서를 작성할 수 있습니다.</p>}
            {period.afterDeadline && <p className="mt-3 text-sm leading-relaxed text-gray-500">지원 접수가 마감되었습니다.</p>}
          </aside>
        </div>
      </>}
    </div>
  );
}
