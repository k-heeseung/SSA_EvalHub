import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, saveDraft, submitApplication } from '../api/applications';
import { uploadAttachmentBatch, deleteAttachment } from '../api/attachments';
import { uploadSelectionError, uploadFilesTogether, uploadResultMessage } from '../utils/attachmentUploads';
import { isFileField, formatFileSize } from '../utils/applicant';
import { formatPhone, formatPhoneInput, isValidPhone, toDigits } from '../utils/phone';
import FieldInput from '../components/FieldInput';
import { normalizeFieldType, hasCheckboxSelection } from '../utils/formFields';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import { useApplicationEditorPeriod } from '../query/useApplicationEditorPeriod';
import { formatProgramPeriod } from '../utils/programSchedule';
import { isApplicationPeriodError, isApplicationDeadlineError } from '../utils/applicationPeriod';
import { useApplicationDeadlineExit } from '../query/useApplicationDeadlineExit';
import ApplicationDeadlineDialog from '../components/ApplicationDeadlineDialog';

function RequiredTag() {
  return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-500">필수</span>;
}

function FieldCard({ children }) {
  return <div className="bg-white rounded-xl border border-gray-200 p-6">{children}</div>;
}

function RequiredFieldsModal({ fields, onClose }) {
  if (fields.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="required-fields-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 4.6l-7 12.1A2 2 0 005 19.7h14a2 2 0 001.7-3l-7-12.1a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h2 id="required-fields-title" className="text-lg font-bold text-gray-900">필수 항목을 작성해주세요</h2>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          지원서를 제출하려면 아래 항목을 먼저 입력해야 합니다.
        </p>
        <ul className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-4">
          {fields.map((field) => (
            <li key={field} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
              <span>{field}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow';

const MEMBER_INPUT_CLASS =
  'flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow';

function LabeledInput({ label, value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className={`${INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`}
      />
    </div>
  );
}


export default function ApplicantFormPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { exitForDeadline, deadlineNotice, confirmDeadlineExit } = useApplicationDeadlineExit();
  const fileInputRef = useRef(null);
  const hydratedApplicationRef = useRef(null);
  const queryClient = useQueryClient();

  const [values, setValues] = useState({});
  const [teamName, setTeamName] = useState('');
  // 지원자 본인/팀원 정보
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [members, setMembers] = useState([]); // [{ name, email, phone }]
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [missingRequiredFields, setMissingRequiredFields] = useState([]);
  const applicationQuery = useLiveApiQuery(
    queryKeys.application(applicationId),
    () => getApplication(applicationId),
  );
  const app = applicationQuery.data ?? null;
  const loading = applicationQuery.isPending;
  const { period, checkPeriod } = useApplicationEditorPeriod(app, queryKeys.application(applicationId), applicationQuery.dataUpdatedAt);
  const writeBlocked = !period.applicationOpen;
  const checkWritePeriod = (operation) => {
    const current = checkPeriod();
    if (current.afterDeadline) exitForDeadline(operation);
    return current.blockedMessage;
  };
  const uploadBlocked = () => {
    const blocked = checkWritePeriod('첨부파일 업로드');
    if (blocked) return blocked;
    const latest = queryClient.getQueryData(queryKeys.application(applicationId));
    if (!latest?.attachmentsEnabled) return '첨부파일을 사용할 수 없는 프로그램입니다.';
    return (latest.attachments?.length || 0) >= (latest.maxAttachments ?? 1)
      ? `첨부파일은 최대 ${latest.maxAttachments ?? 1}개까지 업로드할 수 있습니다.` : '';
  };
  const saveMutation = useMutation({ mutationFn: (payload) => saveDraft(applicationId, payload) });
  const submitMutation = useMutation({ mutationFn: (payload) => submitApplication(applicationId, payload) });
  const uploadMutation = useMutation({
    mutationFn: (files) => uploadFilesTogether(files,
      (selected) => uploadAttachmentBatch(app.teamId, selected), () => applicationQuery.refetch()),
  });
  const deleteAttachmentMutation = useMutation({ mutationFn: deleteAttachment });
  const saving = saveMutation.isPending;
  const submitting = submitMutation.isPending;
  const uploading = uploadMutation.isPending;

  const hydrateForm = (data) => {
    setTeamName(data.teamName || '');
    const info = data.applicantInfo || {};
    setPName(info.name || '');
    setPEmail(info.email || '');
    // 서버에는 숫자만 저장되므로 화면에 채울 때 하이픈 형식으로 되돌린다.
    setPPhone(formatPhone(info.phone));
    setMembers(Array.isArray(info.members)
      ? info.members.map((m) => ({ name: m.name || '', email: m.email || '', phone: formatPhone(m.phone) }))
      : []);
    const initial = {};
    data.fields.forEach((f) => { initial[f.fieldId] = f.value || ''; });
    setValues(initial);
  };

  useEffect(() => {
    if (!app || hydratedApplicationRef.current === applicationId) return;
    hydratedApplicationRef.current = applicationId;
    hydrateForm(app);
  }, [app, applicationId]);

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">로딩 중...</div>;
  if ((error || applicationQuery.isError) && !app) return <div className="max-w-4xl mx-auto px-6 py-16 text-center text-red-500">{error || '지원서를 불러오지 못했습니다.'}</div>;
  if (!app) return null;

  const textFields = app.fields.filter((f) => !isFileField(f.fieldType));
  const attachments = app.attachments || [];

  // 지원 방식: 팀 지원이면 팀명 + 팀원, 개인 지원이면 본인 정보만.
  const isTeam = app.participantType === 'TEAM';

  // PDF 첨부는 프로그램의 첨부파일 설정(attachmentsEnabled)으로 노출한다.
  const attachmentsEnabled = !!app.attachmentsEnabled;
  const maxAttachments = app.maxAttachments || 1;
  const canUploadMore = attachmentsEnabled && attachments.length < maxAttachments;

  // 작성 진행률: 본인 정보 1 + (팀이면 팀명 1) + 답변 항목 + (첨부 사용 시) 첨부 1
  const totalFields = 1 + (isTeam ? 1 : 0) + textFields.length + (attachmentsEnabled ? 1 : 0);
  const filledFields =
    (pName.trim() !== '' ? 1 : 0) +
    (isTeam ? (teamName.trim() !== '' ? 1 : 0) : 0) +
    textFields.filter((f) => (values[f.fieldId] || '').trim() !== '').length +
    (attachmentsEnabled && attachments.length > 0 ? 1 : 0);
  const progress = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);

  const buildPayload = () => ({
    teamName: isTeam ? (teamName.trim() || null) : null,
    participantName: pName.trim() || null,
    participantEmail: pEmail.trim() || null,
    participantPhone: toDigits(pPhone) || null,
    members: isTeam
      ? members
          .filter((m) => m.name.trim() || m.email.trim() || toDigits(m.phone))
          .map((m) => ({ name: m.name.trim(), email: m.email.trim(), phone: toDigits(m.phone) || null }))
      : [],
    answers: textFields.map((f) => ({ formFieldId: f.fieldId, value: values[f.fieldId] ?? '' })),
  });

  const findMissingRequiredFields = () => {
    const missing = [];

    if (isTeam && !teamName.trim()) missing.push('팀 이름');
    if (!pName.trim()) missing.push(isTeam ? '팀장 이름' : '이름');

    app.fields.filter((field) => field.required).forEach((field) => {
      if (isFileField(field.fieldType)) {
        if (attachments.length === 0) missing.push(field.label);
        return;
      }
      const value = values[field.fieldId];
      const isMissing = normalizeFieldType(field.fieldType) === 'CHECKBOX'
        ? !hasCheckboxSelection(value)
        : !String(value ?? '').trim();
      if (isMissing) missing.push(field.label);
    });

    return [...new Set(missing)];
  };

  const handleChange = (fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }));

  const addMember = () => setMembers((prev) => [...prev, { name: '', email: '', phone: '' }]);
  const updateMember = (index, key, value) =>
    setMembers((prev) => prev.map((m, i) => (
      i === index ? { ...m, [key]: key === 'phone' ? formatPhoneInput(value) : value } : m
    )));
  const removeMember = (index) => setMembers((prev) => prev.filter((_, i) => i !== index));

  // 연락처는 선택 항목이지만, 입력했다면 형식이 맞아야 한다. 문제가 있으면 안내 문구를 반환한다.
  const findPhoneError = () => {
    if (pPhone.trim() && !isValidPhone(pPhone)) {
      return isTeam
        ? '대표 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'
        : '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)';
    }
    const badIndex = members.findIndex((m) => m.phone.trim() && !isValidPhone(m.phone));
    if (isTeam && badIndex >= 0) {
      return `팀원 ${badIndex + 1}의 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)`;
    }
    return '';
  };

  const handleSaveDraft = async () => {
    if (saving || submitting || uploading) return;
    const blocked = checkWritePeriod('저장');
    if (blocked) { setError(blocked); return; }
    setError('');
    setMessage('');
    try {
      const { data } = await saveMutation.mutateAsync(buildPayload());
      queryClient.setQueryData(queryKeys.application(applicationId), data);
      setMessage('임시저장되었습니다.');
    } catch (err) {
      if (isApplicationDeadlineError(err)) { exitForDeadline('저장'); return; }
      setError(err.response?.data?.message || '임시저장에 실패했습니다. 입력한 내용은 유지됩니다.');
      void applicationQuery.refetch().then(() => { if (isApplicationPeriodError(err)) checkPeriod(); });
    }
  };

  const handleSubmit = async () => {
    if (saving || submitting || uploading) return;
    const blocked = checkWritePeriod('제출');
    if (blocked) { setError(blocked); return; }
    const missing = findMissingRequiredFields();
    if (missing.length > 0) {
      setMissingRequiredFields(missing);
      return;
    }

    const phoneError = findPhoneError();
    if (phoneError) {
      setMessage('');
      setError(phoneError);
      return;
    }

    setError('');
    setMessage('');
    try {
      await submitMutation.mutateAsync(buildPayload());
      navigate(`/applicant/submissions/${applicationId}`);
    } catch (err) {
      if (isApplicationDeadlineError(err)) { exitForDeadline('제출'); return; }
      void applicationQuery.refetch().then(() => { if (isApplicationPeriodError(err)) checkPeriod(); });
      const serverMessage = err.response?.data?.message || '';
      if (serverMessage.includes('필수') || serverMessage.includes('입력해주세요')) {
        setMissingRequiredFields([serverMessage]);
      } else {
        setError(serverMessage || '제출에 실패했습니다.');
      }
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || uploading || saving || submitting || deleteAttachmentMutation.isPending) return;
    const blocked = uploadBlocked();
    if (blocked) { setError(blocked); return; }
    const latest = queryClient.getQueryData(queryKeys.application(applicationId));
    const selectionError = uploadSelectionError(files.length,
      (latest?.attachments || attachments).length, latest?.maxAttachments ?? maxAttachments);
    setMessage('');
    if (selectionError) { setError(selectionError); return; }
    setError('');
    const result = await uploadMutation.mutateAsync(files);
    if (result.deadlineRejected) { exitForDeadline('첨부파일 업로드'); return; }
    if (result.periodRejected) checkPeriod();
    if (result.failed.length || result.refreshFailed) setError(uploadResultMessage(result));
    else setMessage(uploadResultMessage(result));
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (uploading || saving || submitting || deleteAttachmentMutation.isPending) return;
    const blocked = checkWritePeriod('첨부파일 삭제');
    if (blocked) { setError(blocked); return; }
    try {
      await deleteAttachmentMutation.mutateAsync(attachmentId);
      await applicationQuery.refetch();
    } catch (err) {
      if (isApplicationDeadlineError(err)) { exitForDeadline('첨부파일 삭제'); return; }
      setError(err.response?.data?.message || '첨부파일 삭제에 실패했습니다.');
      void applicationQuery.refetch().then(() => { if (isApplicationPeriodError(err)) checkPeriod(); });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 프로그램 헤더 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6 mb-3">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a4 4 0 100-8 4 4 0 000 8zM8.5 12.5L6 21l6-3 6 3-2.5-8.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{app.programTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {writeBlocked
                ? period.label
                : app.status === 'SUBMITTED' ? '제출 완료 · 마감 전까지 수정 가능' : '작성 중'}
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3" aria-live="polite">지원 기간 {formatProgramPeriod(app, 'application')} · {period.label}</p>

      {/* 마감은 팝업에서만 안내한다. */}
      {!deadlineNotice && (
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 mb-5 text-sm ${
        writeBlocked ? 'bg-red-50 border-red-100 text-red-600' : 'bg-white border-gray-200 text-gray-500'
      }`}>
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {writeBlocked
          ? period.blockedMessage
          : '작성 중인 내용은 임시저장할 수 있으며, 제출 후 마감 전까지 수정할 수 있습니다.'}
      </div>
      )}

      {/* 진행률 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-500">작성 진행률</span>
          <span className="text-gray-600 font-medium">{filledFields} / {totalFields}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {/* 지원 방식별 본인/팀 정보 */}
        {isTeam ? (
          <FieldCard>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-800">팀 정보</h3>
              <RequiredTag />
            </div>
            <div className="space-y-4">
              <LabeledInput label="팀 이름" value={teamName} onChange={setTeamName} placeholder="팀 이름을 입력하세요" disabled={writeBlocked} />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">팀원 정보</label>
                {/* 팀장(본인). 팀장의 연락처가 팀 대표 연락처가 된다. */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded flex-shrink-0 whitespace-nowrap">팀장·본인</span>
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="이름" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                  <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="이메일" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                  <input value={pPhone} onChange={(e) => setPPhone(formatPhoneInput(e.target.value))} placeholder="010-0000-0000" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                  <span className="w-6 flex-shrink-0" />
                </div>
                {/* 추가 팀원 */}
                {members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 px-2 py-1 flex-shrink-0 whitespace-nowrap">팀원 {i + 1}</span>
                    <input value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} placeholder="이름" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                    <input value={m.email} onChange={(e) => updateMember(i, 'email', e.target.value)} placeholder="이메일" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                    <input value={m.phone} onChange={(e) => updateMember(i, 'phone', e.target.value)} placeholder="010-0000-0000" disabled={writeBlocked} className={`${MEMBER_INPUT_CLASS} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`} />
                    <button onClick={() => removeMember(i)} disabled={writeBlocked} className="w-6 flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:text-gray-300">
                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={addMember} disabled={writeBlocked} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors mt-1 disabled:opacity-40 disabled:cursor-default">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  팀원 추가
                </button>
              </div>
            </div>
          </FieldCard>
        ) : (
          <FieldCard>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-800">개인 정보</h3>
              <RequiredTag />
            </div>
            <div className="space-y-3">
              <LabeledInput label="이름" value={pName} onChange={setPName} placeholder="이름" disabled={writeBlocked} />
              <LabeledInput label="연락처" value={pPhone} onChange={(v) => setPPhone(formatPhoneInput(v))} placeholder="010-0000-0000" disabled={writeBlocked} />
              <LabeledInput label="이메일" value={pEmail} onChange={setPEmail} placeholder="you@example.com" disabled={writeBlocked} />
            </div>
          </FieldCard>
        )}

        {/* 제출 받을 항목 항목 (유형별 입력) */}
        {textFields.map((field) => (
          <FieldCard key={field.fieldId}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-800">{field.label}</h3>
              {field.required && <RequiredTag />}
            </div>
            <FieldInput
              field={field}
              value={values[field.fieldId] || ''}
              onChange={(v) => handleChange(field.fieldId, v)}
              disabled={writeBlocked}
            />
          </FieldCard>
        ))}

        {/* PDF 첨부파일 (프로그램에서 첨부 수령을 켠 경우) */}
        {attachmentsEnabled && (
          <FieldCard>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-800">첨부파일 (PDF)</h3>
              <span className="text-xs text-gray-400">최대 {maxAttachments}개 · 파일당 20MB</span>
            </div>

            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{att.originalFilename}</div>
                  <div className="text-xs text-gray-400">{formatFileSize(att.fileSize)} · 업로드 완료</div>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  완료
                </span>
                <button onClick={() => handleDeleteAttachment(att.id)} disabled={writeBlocked || uploading || deleteAttachmentMutation.isPending} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1 disabled:opacity-40 disabled:cursor-default disabled:hover:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}

            {writeBlocked ? (
              !deadlineNotice && <p className="text-xs text-gray-400 text-center py-2">{period.blockedMessage}</p>
            ) : canUploadMore ? (
              <button
                onClick={() => { const blocked = uploadBlocked(); if (blocked) { setError(blocked); return; } fileInputRef.current?.click(); }}
                disabled={writeBlocked || uploading || saving || submitting}
                className="w-full py-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-60"
              >
                {uploading ? '업로드 중...' : '+ PDF 업로드'}
              </button>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">최대 개수까지 첨부했습니다.</p>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple onChange={handleUpload} className="hidden" />
          </FieldCard>
        )}

        {textFields.length === 0 && !attachmentsEnabled && (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm">
            추가로 제출할 항목이 없습니다. 기본 정보를 확인한 후 지원해주세요.
          </div>
        )}
      </div>

      {/* 메시지 */}
      {!deadlineNotice && (message || error) && (
        <p role="status" className={`mt-4 whitespace-pre-line text-sm ${error ? 'text-red-500' : 'text-green-600'}`}>{error || message}</p>
      )}

      {/* 하단 액션 */}
      {writeBlocked ? (
        !deadlineNotice && <div className="mt-6 text-center py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {period.blockedMessage}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleSaveDraft}
            disabled={writeBlocked || saving || submitting || uploading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {saving ? '저장 중...' : '임시저장'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={writeBlocked || saving || submitting || uploading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {submitting ? '제출 중...' : '지원서 제출'}
          </button>
        </div>
      )}

      <ApplicationDeadlineDialog message={deadlineNotice} onConfirm={confirmDeadlineExit} />

      <RequiredFieldsModal
        fields={missingRequiredFields}
        onClose={() => setMissingRequiredFields([])}
      />
    </div>
  );
}
