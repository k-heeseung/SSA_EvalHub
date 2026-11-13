import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOpenPrograms } from '../api/programs';
import { getMyApplications } from '../api/applications';
import { formatProgramPeriod, scheduleInstant } from '../utils/programSchedule';
import { useApplicationPeriods } from '../query/useApplicationPeriods';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import ApplicantQueryNotice from '../components/ApplicantQueryNotice';
import './ApplicantHomePage.css';

function Arrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ProgramCard({ program, period, application }) {
  const scheduled = period.beforeStart;
  const status = application?.status === 'SUBMITTED' ? '지원 완료' : application?.status === 'DRAFT' ? '작성 중' : scheduled ? '접수 예정' : '접수 중';
  return (
    <Link to={`/applicant/programs/${program.id}`} aria-labelledby={`applicant-program-${program.id}`} className="ap-program-card">
      <div className="ap-program-status"><span>{status}</span><span>{scheduled ? `시작 ${period.startLabel || ''}` : period.deadlineLabel}</span></div>
      <h2 id={`applicant-program-${program.id}`}>{program.title}</h2>
      <p className="ap-program-description">{program.description?.trim() || '프로그램 안내에서 지원 자격과 일정을 확인하세요.'}</p>
      <div className="ap-program-footer">
        <div><span>지원 기간</span><p>{formatProgramPeriod(program, 'application')}</p></div>
        <span className="ap-program-arrow"><Arrow /></span>
      </div>
    </Link>
  );
}

export default function ApplicantHomePage() {
  const [selectedTab, setSelectedTab] = useState('open');
  const tabRefs = useRef({});
  const programsQuery = useLiveApiQuery(queryKeys.openPrograms, () => getOpenPrograms());
  const applicationsQuery = useLiveApiQuery(queryKeys.myApplications, () => getMyApplications());
  const { periodFor } = useApplicationPeriods(queryKeys.openPrograms, programsQuery.dataUpdatedAt);
  const programs = programsQuery.data ?? [];
  const applicationsReady = applicationsQuery.isSuccess;
  const myApps = applicationsReady ? (applicationsQuery.data ?? []) : [];
  const appByProgram = Object.fromEntries(myApps.map(app => [app.programId, app]));
  const visiblePrograms = programs.filter(p => ['RECRUITING', 'SCHEDULED'].includes(p.status) && periodFor(p).canApply);
  const scheduledPrograms = programs.filter(p => ['RECRUITING', 'SCHEDULED'].includes(p.status) && periodFor(p).beforeStart)
    .sort((a, b) => Date.parse(scheduleInstant(a, 'applicationStart')) - Date.parse(scheduleInstant(b, 'applicationStart')));
  const draftCount = myApps.filter(app => app.status === 'DRAFT').length;
  const submittedCount = myApps.filter(app => app.status === 'SUBMITTED').length;
  const tabs = [
    { key: 'open', label: '모집 중', programs: visiblePrograms, empty: '현재 모집 중인 프로그램이 없습니다.' },
    { key: 'scheduled', label: '접수 예정', programs: scheduledPrograms, empty: '현재 접수 예정인 프로그램이 없습니다.' },
  ];
  function handleTabKeys(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'open' : event.key === 'End' ? 'scheduled' : selectedTab === 'open' ? 'scheduled' : 'open';
    setSelectedTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="applicant-program-browser">
      <header className="ap-page-heading"><h1>지원하기</h1><p>프로그램 안내를 확인한 뒤 지원서를 작성하세요.</p></header>
      <div className="ap-progress-summary" aria-label="내 지원 현황 요약">
        <p><span className="ap-summary-label">내 지원 현황</span>{applicationsReady ? <><span>작성 중 <strong>{draftCount}건</strong></span><span>지원 완료 <strong>{submittedCount}건</strong></span></> : <span>{applicationsQuery.isError ? '지원 현황을 확인할 수 없습니다.' : '지원 현황 확인 중...'}</span>}</p>
        <Link to="/applicant/submissions">내 지원서<Arrow /></Link>
      </div>
      <ApplicantQueryNotice query={programsQuery} label="프로그램 목록" detail="목록을 확인할 수 없습니다." />
      <ApplicantQueryNotice query={applicationsQuery} label="내 지원서" detail="내 지원 상태를 확인할 수 없습니다. 프로그램 안내는 확인할 수 있지만 새 지원은 상태 확인 후 시작할 수 있습니다." />
      <section aria-label="프로그램 목록">
        <div className="ap-tabs" role="tablist" aria-label="프로그램 분류">
          {tabs.map(tab => <button key={tab.key} ref={node => { tabRefs.current[tab.key] = node; }} id={`program-tab-${tab.key}`} type="button" role="tab" aria-selected={selectedTab === tab.key} aria-controls={`program-panel-${tab.key}`} tabIndex={selectedTab === tab.key ? 0 : -1} onClick={() => setSelectedTab(tab.key)} onKeyDown={handleTabKeys}>{tab.label}<span>{programsQuery.isSuccess ? tab.programs.length : '—'}</span></button>)}
        </div>
        {tabs.map(tab => <div key={tab.key} id={`program-panel-${tab.key}`} role="tabpanel" aria-labelledby={`program-tab-${tab.key}`} tabIndex={0} hidden={selectedTab !== tab.key}>
          {programsQuery.isSuccess && (tab.programs.length > 0 ? <div className="ap-program-grid">{tab.programs.map(program => <ProgramCard key={program.id} program={program} period={periodFor(program)} application={appByProgram[program.id]} />)}</div> : <p className="ap-empty" role="status">{tab.empty}</p>)}
        </div>)}
      </section>
    </div>
  );
}
