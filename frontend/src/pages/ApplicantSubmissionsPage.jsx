import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMyApplications, cancelApplication } from '../api/applications';
import { formatDday, formatDateTime, formatMonthDay } from '../utils/applicant';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const APP_STATUS = {
  DRAFT: { label: '작성 중', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700', action: '이어서 작성' },
  SUBMITTED: { label: '제출 완료', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700', action: '지원서 보기' },
};

const FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'DRAFT', label: '작성 중' },
  { key: 'SUBMITTED', label: '제출 완료' },
];

// 마감일까지 남은 일수 (음수면 마감 지남, null이면 마감일 없음)
function daysUntil(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - today) / 86400000);
}

function StatCard({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
        active ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="text-2xl font-bold text-gray-900">{count}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}

export default function ApplicantSubmissionsPage() {
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);

  const { data: apps = [], isPending: loading, refetch } = useLiveApiQuery(
    queryKeys.myApplications,
    () => getMyApplications(),
  );
  const cancelMutation = useMutation({ mutationFn: cancelApplication });

  const draftCount = apps.filter((a) => a.status === 'DRAFT').length;
  const submittedCount = apps.filter((a) => a.status === 'SUBMITTED').length;

  // 작성 중인데 마감이 3일 이내로 임박한 지원서 (아직 마감 전)
  const urgentDrafts = apps.filter((a) => {
    if (a.status !== 'DRAFT') return false;
    const d = daysUntil(a.applicationDeadline);
    return d !== null && d >= 0 && d <= 3;
  });

  const filtered = filter === 'ALL' ? apps : apps.filter((a) => a.status === filter);

  const goToApp = (app) =>
    navigate(app.status === 'SUBMITTED'
      ? `/applicant/submissions/${app.applicationId}`
      : `/applicant/apply/${app.applicationId}`);

  const handleCancel = async (app) => {
    const msg = app.status === 'SUBMITTED'
      ? '지원을 취소하면 제출한 지원서와 첨부파일이 삭제됩니다. 계속할까요?'
      : '작성 중인 지원서를 삭제할까요? 되돌릴 수 없습니다.';
    if (!window.confirm(msg)) return;
    setCancellingId(app.applicationId);
    setError('');
    try {
      await cancelMutation.mutateAsync(app.applicationId);
      await refetch();
    } catch {
      setError('지원 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">내 지원서</h1>
        <p className="text-sm text-gray-500 mt-1">제출했거나 작성 중인 지원서를 확인하고 관리하세요.</p>
      </div>

      {/* 요약 스트립 (클릭 시 필터) */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="전체" count={apps.length} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <StatCard label="작성 중" count={draftCount} active={filter === 'DRAFT'} onClick={() => setFilter('DRAFT')} />
        <StatCard label="제출 완료" count={submittedCount} active={filter === 'SUBMITTED'} onClick={() => setFilter('SUBMITTED')} />
      </div>

      {/* 마감 임박 경고 (작성 중) */}
      {urgentDrafts.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 4.6l-7 12.1A2 2 0 005 19.7h14a2 2 0 001.7-3l-7-12.1a2 2 0 00-3.4 0z" />
          </svg>
          <div className="text-sm text-amber-800">
            마감이 임박한 <span className="font-semibold">미제출 지원서 {urgentDrafts.length}건</span>이 있습니다.
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-amber-700">
              {urgentDrafts.map((a) => (
                <button
                  key={a.applicationId}
                  onClick={() => goToApp(a)}
                  className="underline underline-offset-2 hover:text-amber-900 cursor-pointer"
                >
                  {a.programTitle} ({formatDday(a.applicationDeadline)})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 필터 세그먼트 */}
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* 지원서 리스트 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-14 text-center">
          <p className="text-gray-400 mb-4">
            {apps.length === 0 ? '아직 작성한 지원서가 없습니다.' : '해당하는 지원서가 없습니다.'}
          </p>
          {apps.length === 0 && (
            <button
              onClick={() => navigate('/applicant')}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              지원하러 가기 →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const status = APP_STATUS[app.status] || APP_STATUS.DRAFT;
            const isTeam = app.participantType === 'TEAM';
            const dday = formatDday(app.applicationDeadline);
            const closed = dday === '마감';
            const time = app.status === 'SUBMITTED' ? app.submittedAt : app.updatedAt;
            const timeLabel = app.status === 'SUBMITTED' ? '제출' : '수정';
            const busy = cancellingId === app.applicationId;

            return (
              <div key={app.applicationId} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{app.programTitle}</h3>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                          {isTeam ? '팀 지원' : '개인 지원'}
                        </span>
                        {isTeam && app.teamName && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-600 truncate max-w-[10rem]">
                            {app.teamName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs mt-2">
                        <span className={`flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-full ${status.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        <span className="text-gray-400">
                          {timeLabel} {formatDateTime(time)}
                        </span>
                        {dday && (
                          <span className={`font-medium ${closed ? 'text-gray-400' : 'text-amber-600'}`}>
                            {closed ? `마감 (${formatMonthDay(app.applicationDeadline)})` : `마감 ${dday}`}
                          </span>
                        )}
                      </div>
                      {closed && app.status === 'DRAFT' && (
                        <p className="text-xs text-red-500 mt-1.5">마감되어 제출할 수 없습니다.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => goToApp(app)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        app.status === 'SUBMITTED'
                          ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          : 'border border-amber-300 text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      {status.action}
                    </button>
                    <button
                      onClick={() => handleCancel(app)}
                      disabled={busy}
                      title="지원 취소"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
