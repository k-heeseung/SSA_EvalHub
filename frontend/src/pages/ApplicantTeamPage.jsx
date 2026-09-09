import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMyApplications, updateTeamInfo } from '../api/applications';
import TeamMemberList from '../components/TeamMemberList';
import { formatPhone, formatPhoneInput, isValidPhone, toDigits } from '../utils/phone';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow';
const MEMBER_INPUT_CLASS =
  'flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow';

// 하나의 제출 지원서에 대한 팀/본인 정보 카드. 보기 ↔ 편집 모드를 자체 관리한다.
function TeamInfoCard({ app, onSaved }) {
  const isTeam = app.participantType === 'TEAM';
  const info = app.applicantInfo || {};
  const deadlinePassed = !!app.applicationDeadline
    && new Date().toISOString().slice(0, 10) > app.applicationDeadline;

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const updateMutation = useMutation({
    mutationFn: (payload) => updateTeamInfo(app.applicationId, payload),
  });
  const saving = updateMutation.isPending;

  const [teamName, setTeamName] = useState('');
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [members, setMembers] = useState([]);

  // 편집 시작: 현재 저장된 값으로 폼을 채운다.
  const startEdit = () => {
    setTeamName(app.teamName || '');
    setPName(info.name || '');
    setPEmail(info.email || '');
    // 서버에는 숫자만 저장되므로 편집 폼에는 하이픈 형식으로 되돌려 채운다.
    setPPhone(formatPhone(info.phone));
    setMembers(Array.isArray(info.members)
      ? info.members.map((m) => ({ name: m.name || '', email: m.email || '', phone: formatPhone(m.phone) }))
      : []);
    setError('');
    setEditing(true);
  };

  const addMember = () => setMembers((prev) => [...prev, { name: '', email: '', phone: '' }]);
  const updateMember = (i, key, value) =>
    setMembers((prev) => prev.map((m, idx) => (
      idx === i ? { ...m, [key]: key === 'phone' ? formatPhoneInput(value) : value } : m
    )));
  const removeMember = (i) => setMembers((prev) => prev.filter((_, idx) => idx !== i));

  // 연락처는 선택 항목이지만, 입력했다면 형식이 맞아야 한다.
  const findPhoneError = () => {
    if (pPhone.trim() && !isValidPhone(pPhone)) {
      return `${isTeam ? '대표 ' : ''}연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)`;
    }
    const badIndex = members.findIndex((m) => m.phone.trim() && !isValidPhone(m.phone));
    if (isTeam && badIndex >= 0) {
      return `팀원 ${badIndex + 1}의 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)`;
    }
    return '';
  };

  const handleSave = async () => {
    setError('');
    const phoneError = findPhoneError();
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const payload = {
      teamName: isTeam ? (teamName.trim() || null) : null,
      participantName: pName.trim() || null,
      participantEmail: pEmail.trim() || null,
      participantPhone: toDigits(pPhone) || null,
      members: isTeam
        ? members
            .filter((m) => m.name.trim() || m.email.trim() || toDigits(m.phone))
            .map((m) => ({ name: m.name.trim(), email: m.email.trim(), phone: toDigits(m.phone) || null }))
        : [],
    };
    try {
      await updateMutation.mutateAsync(payload);
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* 헤더: 어떤 프로그램인지 + 지원 유형 */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4M9 12a3 3 0 11-2.83-4" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-400">지원 프로그램</div>
            <h3 className="font-bold text-gray-900 truncate">{app.programTitle}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {isTeam ? '팀 지원' : '개인 지원'}
          </span>
          {deadlinePassed && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500">마감</span>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              disabled={deadlinePassed}
              title={deadlinePassed ? '지원 마감으로 더 이상 수정할 수 없습니다.' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              수정
            </button>
          )}
        </div>
      </div>

      {/* 본문: 보기 모드 */}
      {!editing ? (
        <div className="pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{isTeam ? '팀 정보' : '지원자 정보'}</h4>
          {isTeam ? (
            <>
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-1">팀 이름</div>
                <div className="text-sm text-gray-800">{app.teamName || '—'}</div>
              </div>
              <TeamMemberList leaderName={info.name} leaderEmail={info.email} members={info.members} phone={info.phone} />
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
      ) : (
        /* 본문: 편집 모드 */
        <div className="pt-4 space-y-4">
          {isTeam ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">팀 이름</label>
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="팀 이름" className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">팀원 정보</label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded flex-shrink-0 whitespace-nowrap">팀장·본인</span>
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="이름" className={MEMBER_INPUT_CLASS} />
                  <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="이메일" className={MEMBER_INPUT_CLASS} />
                  <input value={pPhone} onChange={(e) => setPPhone(formatPhoneInput(e.target.value))} placeholder="010-0000-0000" className={MEMBER_INPUT_CLASS} />
                  <span className="w-6 flex-shrink-0" />
                </div>
                {members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 px-2 py-1 flex-shrink-0 whitespace-nowrap">팀원 {i + 1}</span>
                    <input value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} placeholder="이름" className={MEMBER_INPUT_CLASS} />
                    <input value={m.email} onChange={(e) => updateMember(i, 'email', e.target.value)} placeholder="이메일" className={MEMBER_INPUT_CLASS} />
                    <input value={m.phone} onChange={(e) => updateMember(i, 'phone', e.target.value)} placeholder="010-0000-0000" className={MEMBER_INPUT_CLASS} />
                    <button onClick={() => removeMember(i)} className="w-6 flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={addMember} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  팀원 추가
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="이름" className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">연락처</label>
                <input value={pPhone} onChange={(e) => setPPhone(formatPhoneInput(e.target.value))} placeholder="010-0000-0000" className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="you@example.com" className={INPUT_CLASS} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicantTeamPage() {
  const navigate = useNavigate();
  const applicationsQuery = useLiveApiQuery(queryKeys.myApplications, () => getMyApplications());
  const apps = (applicationsQuery.data ?? []).filter((app) => app.status === 'SUBMITTED');
  const loading = applicationsQuery.isPending;
  const error = applicationsQuery.isError ? '지원서를 불러오지 못했습니다.' : '';

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">팀 정보</h1>
        <p className="text-sm text-gray-500 mt-1">제출한 지원서에 적힌 팀·본인 정보를 확인하고 수정할 수 있습니다. 수정 내용은 해당 지원서에 바로 반영됩니다.</p>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {apps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4M9 12a3 3 0 11-2.83-4" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">제출한 지원서가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">지원서를 제출하면 여기에서 팀 정보를 관리할 수 있습니다.</p>
          <button
            onClick={() => navigate('/applicant')}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            지원하러 가기 →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map((app) => (
            <TeamInfoCard key={app.applicationId} app={app} onSaved={applicationsQuery.refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
