import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, cancelApplication } from '../api/applications';
import { isFileField, formatFileSize, formatDateTime } from '../utils/applicant';
import { FIELD_TYPE_LABEL, normalizeFieldType, parseCheckboxValue } from '../utils/formFields';
import TeamMemberList from '../components/TeamMemberList';
import { formatPhone } from '../utils/phone';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { useApplicationPeriods } from '../query/useApplicationPeriods';
import { formatProgramPeriod, formatScheduleTime, scheduleInstant } from '../utils/programSchedule';

// 제출된 답변을 사람이 읽을 수 있는 문자열로 변환한다. (체크박스는 JSON 배열로 저장됨)
function displayAnswer(field) {
  if (normalizeFieldType(field.fieldType) === 'CHECKBOX') {
    return parseCheckboxValue(field.value).join(', ');
  }
  return field.value || '';
}

export default function ApplicantSubmittedPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [checkingCancel, setCheckingCancel] = useState(false);
  const applicationQuery = useLiveApiQuery(
    queryKeys.application(applicationId),
    () => getApplication(applicationId),
  );
  const app = applicationQuery.data ?? null;
  const loading = applicationQuery.isPending;
  const { periodFor, currentPeriodFor } = useApplicationPeriods(queryKeys.application(applicationId), applicationQuery.dataUpdatedAt);
  const period = periodFor(app);
  const displayError = error || (applicationQuery.isError ? '지원서를 불러오지 못했습니다.' : '');
  const cancelMutation = useMutation({ mutationFn: () => cancelApplication(applicationId) });
  const cancelling = cancelMutation.isPending;

  useEffect(() => {
    if (app && app.status !== 'SUBMITTED') {
      navigate(`/applicant/apply/${applicationId}`, { replace: true });
    }
  }, [app, applicationId, navigate]);

  const handleCancel = async () => {
    if (cancelling || checkingCancel) return;
    if (!currentPeriodFor().canCancel) { setError(currentPeriodFor().cancelMessage); return; }
    if (!window.confirm('지원을 취소하면 제출한 지원서와 첨부파일이 삭제됩니다. 계속할까요?')) return;
    setCheckingCancel(true);
    setError('');
    try {
      const refreshed = await applicationQuery.refetch();
      if (refreshed.isError) { setError('기간을 확인하지 못했습니다. 다시 시도해주세요.'); return; }
      if (!currentPeriodFor().canCancel) { setError(currentPeriodFor().cancelMessage); return; }
      await cancelMutation.mutateAsync();
      navigate('/applicant');
    } catch (err) {
      setError(err.response?.data?.message || '지원 취소에 실패했습니다.');
      void applicationQuery.refetch();
    } finally {
      setCheckingCancel(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400">로딩 중...</div>;
  if (displayError && !app) return <div className="max-w-3xl mx-auto px-6 py-16 text-center text-red-500">{displayError}</div>;
  if (!app) return null;

  const deadline = formatScheduleTime(scheduleInstant(app, 'applicationDeadline'));
  const writeBlocked = !period.applicationOpen;
  const evaluationStarted = !period.canCancel;
  const attachments = app.attachments || [];
  const info = app.applicantInfo || {};
  const isTeam = app.participantType === 'TEAM';
  const attachmentsEnabled = !!app.attachmentsEnabled;
  const answerFields = app.fields.filter((f) => !isFileField(f.fieldType));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {displayError && <p role="alert" className="text-sm text-red-600 mb-4">{displayError}</p>}
      <p className="text-sm text-gray-500 mb-3" aria-live="polite">지원 기간 {formatProgramPeriod(app, 'application')} · {period.label}</p>
      {/* 제출 완료 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-500 flex-shrink-0">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">제출 완료</h1>
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                접수됨
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {app.programTitle} 지원서가 정상 접수되었습니다.
              {deadline && (writeBlocked
                ? <> {period.blockedMessage}</>
                : <> 마감({deadline})까지 수정할 수 있습니다.</>)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-gray-400">제출 일시</div>
            <div className="text-sm font-mono text-gray-700 mt-0.5">{formatDateTime(app.submittedAt)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100">
          <button
            onClick={() => { const blocked = currentPeriodFor().blockedMessage; if (blocked) { setError(blocked); return; } navigate(`/applicant/apply/${applicationId}`); }}
            disabled={writeBlocked}
            title={period.blockedMessage || undefined}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            지원서 수정
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling || checkingCancel || evaluationStarted}
            title={evaluationStarted ? '평가가 시작되어 온라인으로 취소할 수 없습니다. 담당자에게 문의해주세요.' : undefined}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {cancelling ? '취소 중...' : '지원 취소'}
          </button>
        </div>
        {evaluationStarted && (
          <p className="text-xs text-gray-400 text-right mt-2">
            평가가 시작되어 온라인 취소가 불가능합니다. 취소가 필요하면 담당자에게 문의해주세요.
          </p>
        )}
      </div>

      {/* 제출한 지원서 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">제출한 지원서</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {isTeam ? '팀 지원' : '개인 지원'}
            </span>
          </div>
          <span className="text-sm text-gray-400 font-mono">#{app.applicationId}</span>
        </div>

        {/* 지원 정보 (본인/팀 정보) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{isTeam ? '팀 정보' : '지원자 정보'}</h3>
          {isTeam ? (
            <>
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-1">팀 이름</div>
                <div className="text-sm text-gray-800">{app.teamName || '—'}</div>
              </div>
              <TeamMemberList
                leaderName={info.name}
                leaderEmail={info.email}
                members={info.members}
                phone={info.phone}
              />
            </>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">이름</div>
                <div className="text-sm text-gray-800 break-all">{info.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">이메일</div>
                <div className="text-sm text-gray-800 break-all">{info.email || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">연락처</div>
                <div className="text-sm text-gray-800 break-all">{formatPhone(info.phone) || '—'}</div>
              </div>
            </div>
          )}
        </div>

        {/* 제출 받을 항목 답변 */}
        {answerFields.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">제출 받을 항목</h3>
            <div className="divide-y divide-gray-100">
              {answerFields.map((field) => {
                const answer = displayAnswer(field);
                return (
                  <div key={field.fieldId} className="py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {FIELD_TYPE_LABEL[normalizeFieldType(field.fieldType)]}
                      </span>
                      <span className="text-sm font-medium text-gray-500">{field.label}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{answer || <span className="text-gray-300">미작성</span>}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 첨부파일 (PDF) */}
        {(attachmentsEnabled || attachments.length > 0) && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">첨부파일 (PDF)</h3>
            {attachments.length === 0 ? (
              <p className="text-gray-300 text-sm">첨부한 파일이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700">{att.originalFilename}</div>
                      <div className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
