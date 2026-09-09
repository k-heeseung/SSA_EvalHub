import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPrograms, getTeam, getTeamApplication, changeTeamStatus, deleteTeam,
  removeTeamMember, addTeamMember, getEvaluationResults, lookupUser, updateTeam,
  updateTeamApplication,
} from '../api/programs';
import { getTeamAttachments, uploadAttachment, deleteAttachment } from '../api/attachments';
import { programTypeLabel } from '../utils/labels';
import { normalizeFieldType, isFileType, parseCheckboxValue } from '../utils/formFields';
import PageHeader from '../components/PageHeader';
import FieldInput from '../components/FieldInput';
import TeamMemberList from '../components/TeamMemberList';
import { formatPhone, formatPhoneInput, isValidPhone, toDigits } from '../utils/phone';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { teamAverage, teamBonus, teamFinalScore } from '../utils/export';

// 제출된 답변을 읽기 좋은 문자열로 변환 (체크박스는 JSON 배열로 저장됨)
function displayAnswer(field) {
  if (normalizeFieldType(field.fieldType) === 'CHECKBOX') {
    return parseCheckboxValue(field.value).join(', ');
  }
  return field.value || '';
}

const STATUS_MAP = {
  PENDING: { label: '평가 전', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  PASSED:  { label: '합격',   dot: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  FAILED:  { label: '불합격', dot: 'bg-red-400',   badge: 'bg-red-50 text-red-600' },
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '평가 전' },
  { value: 'PASSED',  label: '합격' },
  { value: 'FAILED',  label: '불합격' },
];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${min}`;
}

function Avatar({ email, size = 'md', className = '' }) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
  ];
  const color = colors[(email?.charCodeAt(0) || 0) % colors.length];
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  return (
    <div className={`${sizeClass} ${color} ${className} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {(email || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 mt-0.5 break-all">{value || '—'}</div>
    </div>
  );
}

export default function TeamDetailPage() {
  const { programId, teamId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [statusDraft, setStatusDraft] = useState(null); // 평가 상태 임시 선택(저장 전)
  const fileInputRef = useRef(null);
  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const teamQuery = useLiveApiQuery(queryKeys.team(programId, teamId), () => getTeam(programId, teamId));
  const attachmentsQuery = useLiveApiQuery(
    queryKeys.teamAttachments(teamId),
    () => getTeamAttachments(teamId),
  );
  const resultsQuery = useLiveApiQuery(
    queryKeys.evaluationResults(programId),
    () => getEvaluationResults(programId),
  );
  const applicationQuery = useLiveApiQuery(
    queryKeys.teamApplication(teamId),
    () => getTeamApplication(teamId),
    { retry: false },
  );
  const program = (programsQuery.data ?? []).find((item) => item.id === Number(programId)) ?? null;
  const team = teamQuery.data ?? null;
  const attachments = attachmentsQuery.data ?? [];
  const teamResult = (resultsQuery.data ?? []).find((result) => result.teamId === Number(teamId)) ?? null;
  const application = applicationQuery.data ?? null;
  const loading = programsQuery.isPending || teamQuery.isPending || attachmentsQuery.isPending
    || resultsQuery.isPending || applicationQuery.isPending;
  const statusMutation = useMutation({
    mutationFn: (newStatus) => changeTeamStatus(programId, teamId, { status: newStatus }),
  });
  const deleteTeamMutation = useMutation({ mutationFn: () => deleteTeam(programId, teamId) });
  const removeMemberMutation = useMutation({ mutationFn: (memberId) => removeTeamMember(teamId, memberId) });
  const uploadMutation = useMutation({ mutationFn: (file) => uploadAttachment(teamId, file) });
  const deleteAttachmentMutation = useMutation({ mutationFn: deleteAttachment });
  const statusChanging = statusMutation.isPending;
  const uploading = uploadMutation.isPending;

  // 평가 상태 저장: 임시 선택(statusDraft)을 서버에 반영한다.
  const handleStatusSave = async () => {
    if (statusDraft == null || statusDraft === team?.status) return;
    try {
      const res = await statusMutation.mutateAsync(statusDraft);
      queryClient.setQueryData(queryKeys.team(programId, teamId), res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.evaluationResults(programId) });
      setStatusDraft(null);
    } catch {
      alert('상태 변경에 실패했습니다.');
    }
  };

  // 팀 필드(매니저 생성 팀) 수정 저장 후: 캐시 갱신 및 목록/결과 무효화.
  const handleTeamUpdated = (updated) => {
    queryClient.setQueryData(queryKeys.team(programId, teamId), updated);
    queryClient.invalidateQueries({ queryKey: queryKeys.teams(programId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.evaluationResults(programId) });
    setShowEditTeam(false);
  };

  // 지원 정보(지원자 팀) 수정 저장 후: 지원서·팀 재조회 및 목록/결과 무효화.
  const handleApplicationUpdated = () => {
    applicationQuery.refetch();
    teamQuery.refetch();
    queryClient.invalidateQueries({ queryKey: queryKeys.teams(programId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.evaluationResults(programId) });
    setShowEditTeam(false);
  };

  const handleDeleteTeam = async () => {
    if (!window.confirm(`"${team?.name}" 팀을 삭제하시겠습니까?\n하위 팀원, 첨부파일, 배정이 모두 삭제됩니다.`)) return;
    try {
      await deleteTeamMutation.mutateAsync();
      navigate(`/admin/programs/${programId}`, { state: { defaultTab: 0 } });
    } catch {
      alert('팀 삭제에 실패했습니다.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('팀원을 삭제하시겠습니까?')) return;
    try {
      await removeMemberMutation.mutateAsync(memberId);
    } catch {
      alert('팀원 삭제에 실패했습니다.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadMutation.mutateAsync(file);
      await attachmentsQuery.refetch();
    } catch {
      alert('파일 업로드에 실패했습니다. PDF 파일만 업로드 가능합니다.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('파일을 삭제하시겠습니까?')) return;
    try {
      await deleteAttachmentMutation.mutateAsync(attachmentId);
    } catch {
      alert('파일 삭제에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">로딩 중...</div>;
  if (!team) return <div className="p-8 text-red-500">팀을 찾을 수 없습니다.</div>;

  const scoreResult = {
    evaluations: teamResult?.evaluations ?? [],
    bonusScore: teamResult?.bonusScore ?? team.bonusScore ?? null,
  };
  const submittedEvals = scoreResult.evaluations.filter(
    (e) => e.submission?.status === 'SUBMITTED',
  );
  const averageScore = teamAverage(scoreResult);
  const bonusScore = teamBonus(scoreResult);
  const totalScore = teamFinalScore(scoreResult);
  const hasBonus = program?.bonusEnabled || scoreResult.bonusScore != null;

  const currentStatus = STATUS_MAP[team.status] || STATUS_MAP.PENDING;
  const selectedStatus = statusDraft ?? team.status;   // 화면에 표시할 선택값(저장 전 포함)
  const statusDirty = statusDraft != null && statusDraft !== team.status;

  // 지원 정보(지원자가 제출한 본인/팀원 정보 + 양식 답변)
  const appInfo = application?.applicantInfo || {};
  const isTeamApp = application?.participantType === 'TEAM';
  const answerFields = (application?.fields || []).filter((f) => !isFileType(f.fieldType));
  const appSubmitted = application?.status === 'SUBMITTED';

  return (
    <div className="p-8">
      {/* 브레드크럼 + 액션 버튼 */}
      <PageHeader
        breadcrumb={[
          'EvalHub',
          { label: '팀 관리', onClick: () => navigate(`/admin/programs/${programId}`, { state: { defaultTab: 0 } }) },
          team.name,
        ]}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditTeam(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            정보 수정
          </button>
          <button
            onClick={handleDeleteTeam}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-500 hover:bg-red-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            팀 삭제
          </button>
        </div>
      </PageHeader>

      <div className="flex gap-6 items-start">
        {/* 왼쪽 패널 */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* 팀 정보 카드 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                {program && (
                  <button
                    onClick={() => navigate(`/admin/programs/${programId}`, { state: { defaultTab: 0 } })}
                    className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer group"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3h14M5 3a2 2 0 00-2 2v3a7 7 0 007 7m-5-10h10m0 0a2 2 0 012 2v3a7 7 0 01-7 7m0 0v3m0 0h-4m4 0h4" />
                    </svg>
                    <span className="font-medium truncate group-hover:underline">{program.title}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">{programTypeLabel(program.type)}</span>
                  </button>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-gray-900">{team.name}</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentStatus.badge}`}>
                    {currentStatus.label}
                  </span>
                </div>
                {team.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">{team.description}</p>
                )}
                {team.submissionUrl && (
                  <a
                    href={team.submissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                  >
                    {team.submissionUrl}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 지원 정보 (지원자가 제출한 본인/팀원 정보 + 양식 답변) */}
          {application ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-800">지원 정보</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    {isTeamApp ? '팀 지원' : '개인 지원'}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${appSubmitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {appSubmitted ? '제출 완료' : '작성 중'}
                </span>
              </div>
              <div className="p-5 space-y-5">
                {/* 지원자 / 팀 구성원 */}
                {isTeamApp ? (
                  <TeamMemberList
                    leaderName={appInfo.name}
                    leaderEmail={appInfo.email}
                    members={appInfo.members}
                    phone={appInfo.phone}
                  />
                ) : (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-2">지원자</div>
                    <div className="grid grid-cols-3 gap-3">
                      <Info label="이름" value={appInfo.name} />
                      <Info label="이메일" value={appInfo.email} />
                      <Info label="연락처" value={formatPhone(appInfo.phone)} />
                    </div>
                  </div>
                )}

                {/* 지원서 양식 답변 */}
                {answerFields.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    {answerFields.map((f) => {
                      const ans = displayAnswer(f);
                      return (
                        <div key={f.fieldId}>
                          <div className="text-xs font-medium text-gray-500 mb-1">{f.label}</div>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {ans || <span className="text-gray-300">미작성</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 첨부파일 (PDF) — 지원자가 제출한 것 */}
                {(application.attachmentsEnabled || attachments.length > 0) && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="text-xs font-medium text-gray-400 mb-2">첨부파일 (PDF)</div>
                    {attachments.length === 0 ? (
                      <p className="text-sm text-gray-300">첨부된 파일이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map((att) => (
                          <div key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{att.originalFilename}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{formatBytes(att.fileSize)} · {formatDate(att.uploadedAt)}</div>
                            </div>
                            <a
                              href={att.contentUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="열기"
                              className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              title="삭제"
                              className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
              지원자가 제출한 지원 정보가 없습니다. (매니저가 직접 등록한 팀)
            </div>
          )}

          {/* 팀원(계정) 섹션 — 매니저가 직접 만든 팀에서만 노출. 지원자가 제출한 팀은 위 '지원 정보'에 팀원 명단이 있다. */}
          {!application && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">팀원</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {team.members?.length ?? 0}명
                </span>
              </div>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                팀원 추가
              </button>
            </div>

            {(!team.members || team.members.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm">등록된 팀원이 없습니다.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {team.members.map((member, idx) => (
                  <div key={member.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <Avatar email={member.email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{member.email}</span>
                        {idx === 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            팀장
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                      title="팀원 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* 제출 파일 섹션 — 매니저가 직접 만든 팀에서만. 지원자 팀의 첨부파일은 위 '지원 정보' 카드에 있다. */}
          {!application && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">제출 파일</h2>
                {attachments.length > 0 ? (
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    제출 완료
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                    미제출
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {uploading ? '업로드 중...' : '파일 추가'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {attachments.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="text-center py-10 text-gray-400 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF 파일을 업로드하세요
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{att.originalFilename}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatBytes(att.fileSize)} · {formatDate(att.uploadedAt)}
                      </div>
                    </div>
                    <a
                      href={att.contentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer flex-shrink-0"
                      title="다운로드"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        {/* 오른쪽 패널 */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* 평가 상태 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">평가 상태</h3>
            <p className="text-xs text-gray-400 mb-4">지원자에게는 노출되지 않습니다.</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedStatus === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  } ${statusChanging ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="teamStatus"
                    value={opt.value}
                    checked={selectedStatus === opt.value}
                    onChange={() => setStatusDraft(opt.value)}
                    className="accent-blue-600"
                  />
                  <span className={`text-sm font-medium ${selectedStatus === opt.value ? 'text-blue-700' : 'text-gray-600'}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            {/* 변경이 있으면 취소/완료 버튼 활성화 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStatusDraft(null)}
                disabled={!statusDirty || statusChanging}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              >
                취소
              </button>
              <button
                onClick={handleStatusSave}
                disabled={!statusDirty || statusChanging}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 cursor-pointer disabled:cursor-not-allowed"
              >
                {statusChanging ? '저장 중...' : '완료'}
              </button>
            </div>
          </div>

          {/* 평가 요약 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">평가 요약</h3>
            {hasBonus ? (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-[11px] text-gray-400 mb-1">심사위원 평균</p>
                  <p className="text-lg font-bold text-gray-700">
                    {averageScore == null ? '—' : averageScore.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
                  <p className="text-[11px] text-purple-500 mb-1">가산점</p>
                  <p className="text-lg font-bold text-purple-700">
                    {scoreResult.bonusScore != null ? `+${bonusScore}` : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <p className="text-[11px] text-blue-500 mb-1">총합</p>
                  <p className="text-lg font-bold text-blue-700">
                    {totalScore == null ? '—' : totalScore.toFixed(1)}
                  </p>
                </div>
              </div>
            ) : submittedEvals.length > 0 ? (
              <div className="text-center mb-5">
                <div className="text-5xl font-bold text-blue-600 leading-none mb-1">
                  {averageScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  심사위원 {submittedEvals.length}명 평균 · 100점 만점
                </div>
              </div>
            ) : null}

            {submittedEvals.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">제출된 평가가 없습니다.</div>
            ) : (
              <>
                {hasBonus && (
                  <div className="text-center text-xs text-gray-400 mb-4">
                    심사위원 {submittedEvals.length}명 평균 · 100점 만점
                  </div>
                )}
                <div className="space-y-3">
                  {submittedEvals.map((e) => {
                    const score = Number(e.submission.totalScore);
                    const emailShort = (e.evaluatorEmail || '').split('@')[0];
                    return (
                      <div key={e.evaluatorId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 font-medium truncate max-w-[120px]">{emailShort}</span>
                          <span className="text-gray-800 font-semibold">{score}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 팀원 추가 모달 */}
      {showAddMember && (
        <AddMemberModal
          teamId={teamId}
          onClose={() => setShowAddMember(false)}
          onAdded={() => { setShowAddMember(false); teamQuery.refetch(); }}
        />
      )}

      {/* 정보 수정 모달: 지원자 팀이면 제출 지원정보 편집, 매니저 생성 팀이면 팀 필드 편집 */}
      {showEditTeam && (application ? (
        <EditApplicationModal
          teamId={teamId}
          application={application}
          attachments={attachments}
          onAttachmentsChanged={() => attachmentsQuery.refetch()}
          onClose={() => setShowEditTeam(false)}
          onSaved={handleApplicationUpdated}
        />
      ) : (
        <EditTeamModal
          programId={programId}
          teamId={teamId}
          team={team}
          onClose={() => setShowEditTeam(false)}
          onSaved={handleTeamUpdated}
        />
      ))}
    </div>
  );
}

// 지원자 팀: 팀이 제출한 지원 정보(팀명·본인/팀원·양식 답변·첨부파일) 전체를 수정하는 모달.
function EditApplicationModal({ teamId, application, attachments = [], onAttachmentsChanged, onClose, onSaved }) {
  const isTeam = application.participantType === 'TEAM';
  const appInfo = application.applicantInfo || {};
  const textFields = (application.fields || []).filter((f) => !isFileType(f.fieldType));
  const attachmentsEnabled = application.attachmentsEnabled || attachments.length > 0;
  const maxAttachments = application.maxAttachments ?? null;
  const atMax = maxAttachments != null && attachments.length >= maxAttachments;
  const fileInputRef = useRef(null);

  const [teamName, setTeamName] = useState(application.teamName || '');
  const [participant, setParticipant] = useState({
    name: appInfo.name || '',
    email: appInfo.email || '',
    // 서버에는 숫자만 저장되므로 편집 폼에는 하이픈 형식으로 되돌려 채운다.
    phone: formatPhone(appInfo.phone),
  });
  const [members, setMembers] = useState(
    (appInfo.members || []).map((m) => ({ name: m.name || '', email: m.email || '', phone: formatPhone(m.phone) })),
  );
  const [answers, setAnswers] = useState(
    () => Object.fromEntries(textFields.map((f) => [f.fieldId, f.value || ''])),
  );
  const [error, setError] = useState('');

  const setParticipantField = (key) => (e) => {
    const raw = e.target.value;
    setParticipant((p) => ({ ...p, [key]: key === 'phone' ? formatPhoneInput(raw) : raw }));
    setError('');
  };
  const setMember = (idx, key, val) => setMembers((prev) => prev.map((m, i) => (
    i === idx ? { ...m, [key]: key === 'phone' ? formatPhoneInput(val) : val } : m
  )));
  const addMember = () => setMembers((prev) => [...prev, { name: '', email: '', phone: '' }]);
  const removeMember = (idx) => setMembers((prev) => prev.filter((_, i) => i !== idx));

  // 연락처는 선택 항목이지만, 입력했다면 형식이 맞아야 한다.
  const findPhoneError = () => {
    if (participant.phone.trim() && !isValidPhone(participant.phone)) {
      return '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)';
    }
    const badIndex = members.findIndex((m) => m.phone.trim() && !isValidPhone(m.phone));
    if (isTeam && badIndex >= 0) {
      return `팀원 ${badIndex + 1}의 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)`;
    }
    return '';
  };

  const mutation = useMutation({
    mutationFn: () => updateTeamApplication(teamId, {
      teamName: isTeam ? teamName.trim() : null,
      participantName: participant.name.trim(),
      participantEmail: participant.email.trim() || null,
      participantPhone: toDigits(participant.phone) || null,
      members: isTeam
        ? members
            .filter((m) => m.name.trim() || m.email.trim() || toDigits(m.phone))
            .map((m) => ({ name: m.name.trim() || null, email: m.email.trim() || null, phone: toDigits(m.phone) || null }))
        : [],
      answers: textFields.map((f) => ({ formFieldId: f.fieldId, value: answers[f.fieldId] ?? '' })),
    }),
    onSuccess: () => onSaved(),
    onError: () => setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.'),
  });

  const uploadMut = useMutation({ mutationFn: (file) => uploadAttachment(teamId, file) });
  const deleteMut = useMutation({ mutationFn: (attachmentId) => deleteAttachment(attachmentId) });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      await uploadMut.mutateAsync(file);
      onAttachmentsChanged?.();
    } catch {
      setError('파일 업로드에 실패했습니다. PDF 파일만 업로드할 수 있습니다.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('파일을 삭제하시겠습니까?')) return;
    try {
      await deleteMut.mutateAsync(attachmentId);
      onAttachmentsChanged?.();
    } catch {
      setError('파일 삭제에 실패했습니다.');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (isTeam && !teamName.trim()) { setError('팀 이름을 입력해주세요.'); return; }
    if (!participant.name.trim()) { setError(isTeam ? '팀장(본인) 이름을 입력해주세요.' : '이름을 입력해주세요.'); return; }
    const phoneError = findPhoneError();
    if (phoneError) { setError(phoneError); return; }
    mutation.mutate();
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">지원 정보 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5 overflow-y-auto">
          {/* 팀명 / 본인 정보 */}
          <div className="space-y-3">
            {isTeam && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">팀 이름</label>
                <input type="text" value={teamName} onChange={(e) => { setTeamName(e.target.value); setError(''); }} className={inputClass} />
              </div>
            )}
            <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{isTeam ? '팀장 이름' : '이름'}</label>
                <input type="text" value={participant.name} onChange={setParticipantField('name')} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                <input type="email" value={participant.email} onChange={setParticipantField('email')} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">연락처</label>
                <input type="text" value={participant.phone} onChange={setParticipantField('phone')} className={inputClass} />
              </div>
            </div>
          </div>

          {/* 팀원 (팀 지원만) */}
          {isTeam && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">팀원</label>
                <button type="button" onClick={addMember} className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">+ 팀원 추가</button>
              </div>
              <div className="space-y-2">
                {members.length === 0 && <p className="text-xs text-gray-400">추가 팀원이 없습니다.</p>}
                {members.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" value={m.name} onChange={(e) => setMember(idx, 'name', e.target.value)} placeholder="이름" className={`${inputClass} flex-1`} />
                    <input type="email" value={m.email} onChange={(e) => setMember(idx, 'email', e.target.value)} placeholder="이메일" className={`${inputClass} flex-1`} />
                    <input type="tel" value={m.phone} onChange={(e) => setMember(idx, 'phone', e.target.value)} placeholder="010-0000-0000" className={`${inputClass} flex-1`} />
                    <button type="button" onClick={() => removeMember(idx)} className="text-gray-300 hover:text-red-400 cursor-pointer p-1 flex-shrink-0" title="삭제">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 지원서 양식 답변 */}
          {textFields.length > 0 && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">지원서 답변</p>
              {textFields.map((f) => (
                <div key={f.fieldId}>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    {f.label}
                    {f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <FieldInput
                    field={f}
                    value={answers[f.fieldId] ?? ''}
                    onChange={(val) => { setAnswers((prev) => ({ ...prev, [f.fieldId]: val })); setError(''); }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 첨부파일 (PDF) */}
          {attachmentsEnabled && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  첨부파일 (PDF)
                  {maxAttachments != null && <span className="text-xs text-gray-400 ml-1">최대 {maxAttachments}개</span>}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMut.isPending || atMax}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploadMut.isPending ? '업로드 중...' : '+ 파일 추가'}
                </button>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUpload} className="hidden" />
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-gray-400">첨부된 파일이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{att.originalFilename}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{formatBytes(att.fileSize)} · {formatDate(att.uploadedAt)}</div>
                      </div>
                      <a href={att.contentUrl} target="_blank" rel="noreferrer" title="열기" className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button type="button" onClick={() => handleDeleteAttachment(att.id)} title="삭제" className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">취소</button>
          <button type="button" onClick={submit} disabled={mutation.isPending} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {mutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTeamModal({ programId, teamId, team, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: team.name || '',
    description: team.description || '',
    submissionUrl: team.submissionUrl || '',
    notes: team.notes || '',
  });
  const [error, setError] = useState('');
  const set = (key) => (e) => { setForm((prev) => ({ ...prev, [key]: e.target.value })); setError(''); };

  const mutation = useMutation({
    mutationFn: () => updateTeam(programId, teamId, {
      name: form.name.trim(),
      description: form.description.trim() || null,
      submissionUrl: form.submissionUrl.trim() || null,
      notes: form.notes.trim() || null,
    }),
    onSuccess: (res) => onSaved(res.data),
    onError: () => setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('팀 이름을 입력해주세요.'); return; }
    mutation.mutate();
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">팀 정보 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">팀 이름</label>
            <input type="text" value={form.name} onChange={set('name')} className={inputClass} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">설명</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">제출 URL</label>
            <input type="url" value={form.submissionUrl} onChange={set('submissionUrl')} placeholder="https://" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비고</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputClass} resize-none`} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">취소</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {mutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const emptyRow = () => ({ email: '', message: '' });

function AddMemberModal({ teamId, onClose, onAdded }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [error, setError] = useState('');
  const addMutation = useMutation({
    mutationFn: (emails) => Promise.allSettled(
      emails.map((email) => addTeamMember(teamId, { email })),
    ),
  });
  const submitting = addMutation.isPending;

  const patchRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 공백 제거 후 빈 값과 중복 제거
    const emails = [...new Set(rows.map((r) => r.email.trim()).filter(Boolean))];
    if (emails.length === 0) { setError('이메일 주소를 입력해주세요.'); return; }

    try {
      // 추가 전에 각 이메일이 실제 존재하는 사용자인지 먼저 확인한다.
      const lookups = await Promise.all(
        emails.map((email) => lookupUser(email).then(() => null).catch((err) => (
          err.response?.status === 404 ? '존재하지 않는 사용자입니다.' : '확인에 실패했습니다.'
        ))),      
      );
      // 존재하지 않는 이메일이 있으면 추가하지 않고 해당 입력란 아래에 문구를 표시한다.
      const errorByEmail = new Map(emails.map((email, i) => [email, lookups[i]]).filter(([, msg]) => msg));
      if (errorByEmail.size > 0) {
        setRows((prev) => prev.map((r) => ({ ...r, message: errorByEmail.get(r.email.trim()) || '' })));
        return;
      }

      // 모두 존재하는 사용자이므로 추가한다.
      const results = await addMutation.mutateAsync(emails);
      const failed = results
        .map((res, i) => ({ res, email: emails[i] }))
        .filter(({ res }) => res.status === 'rejected');

      if (failed.length > 0) {
        // 이미 팀에 있는 등의 사유로 실패한 이메일 아래에 문구를 표시한다.
        const failMsg = new Map(failed.map(({ res, email }) => [email, res.reason?.response?.data?.message || '추가에 실패했습니다.']));
        setRows((prev) => prev.map((r) => ({ ...r, message: failMsg.get(r.email.trim()) || '' })));
        return;
      }

      // 추가 완료: 창을 닫고 목록에 반영한다.
      onAdded();
    } finally {
      // pending state is managed by the mutation.
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">팀원 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일 주소</label>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => patchRow(idx, { email: e.target.value, message: '' })}
                      placeholder="이메일 주소 입력"
                      className={`flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                        row.message ? 'border-red-300' : 'border-gray-200'
                      }`}
                      autoFocus={idx === 0}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-300 cursor-pointer p-1"
                      title="행 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
                      </svg>
                    </button>
                  </div>
                  {row.message && <p className="text-red-500 text-xs mt-1">{row.message}</p>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              이메일 추가
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">취소</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {submitting ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
