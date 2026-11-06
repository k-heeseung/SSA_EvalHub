import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getEvaluators, createEvaluator, deleteEvaluator, getInvitations, retryInvitation } from '../api/evaluators';
import { getPrograms, createAssignment } from '../api/programs';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];

function getAvatarColor(email = '') {
  const idx = email.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(email = '') {
  return email.charAt(0).toUpperCase();
}

export default function EvaluatorsPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const evaluatorsQuery = useLiveApiQuery(queryKeys.evaluators, () => getEvaluators());
  const invitationsQuery = useLiveApiQuery(queryKeys.evaluatorInvitations, () => getInvitations(), { refetchInterval: 5000 });
  const invitations = new Map((invitationsQuery.data?.invitations ?? []).map((item) => [item.userId, item]));
  const [notice, setNotice] = useState('');
  const retryMutation = useMutation({
    mutationFn: (id) => retryInvitation(id),
    onSuccess: () => { setNotice('안내 메일 재시도가 예약되었습니다.'); invitationsQuery.refetch(); },
    onError: (err) => setNotice(err.response?.data?.message || '재시도를 요청하지 못했습니다.'),
  });
  const evaluators = evaluatorsQuery.data ?? [];
  const loading = evaluatorsQuery.isPending;
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => deleteEvaluator(id))),
  });
  const deleting = deleteMutation.isPending;

  const enterEditMode = () => {
    setEditMode(true);
    setSelectedIds(new Set());
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 심사위원 ${selectedIds.size}명을 삭제하시겠습니까?`)) return;
    try {
      await deleteMutation.mutateAsync([...selectedIds]);
      exitEditMode();
    } catch {
      alert('삭제에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  const active = evaluators.filter((e) => e.status === 'ACTIVE' || !e.status);
  const inactive = evaluators.filter((e) => e.status && e.status !== 'ACTIVE');

  const filtered = evaluators.filter((e) =>
    !search || e.email?.toLowerCase().includes(search.toLowerCase()) ||
    e.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {notice && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {invitationsQuery.isError && <p role="alert" className="mb-4 text-sm text-red-600">메일 발송 상태를 불러오지 못했습니다.</p>}
      {invitationsQuery.data?.creationEnabled === false && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">메일 설정을 준비 중입니다. 설정이 완료되면 심사위원 계정을 생성할 수 있습니다.</p>}
      {invitationsQuery.data?.deliveryEnabled === false && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">메일 발송이 비활성화되어 있습니다. 생성한 계정의 안내 메일은 발송 대기 상태로 보관됩니다.</p>}
      {/* 헤더 */}
      <PageHeader
        breadcrumb={['EvalHub', '심사위원']}
        title="심사위원 계정 관리"
        subtitle="전체 심사위원 계정을 생성·관리하고 프로그램별로 배정합니다."
      >
        <div className="flex items-center gap-2">
          <button
            disabled={invitationsQuery.data?.creationEnabled === false}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 계정 생성
          </button>
        </div>
      </PageHeader>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<UsersStatIcon className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="전체 심사위원"
          value={evaluators.length}
          sub={`활성 ${active.length} · 비활성 ${inactive.length}`}
          borderColor="border-l-blue-400"
        />
        <StatCard
          icon={<CheckStatIcon className="text-green-500" />}
          iconBg="bg-green-50"
          title="활성 계정"
          value={active.length}
          sub="최근 7일 접속"
          borderColor="border-l-green-400"
        />
        <StatCard
          icon={<GridStatIcon className="text-purple-500" />}
          iconBg="bg-purple-50"
          title="총 배정 건"
          value="—"
          sub="전체 배정 합산"
          borderColor="border-l-purple-400"
        />
        <StatCard
          icon={<ClockStatIcon className="text-amber-500" />}
          iconBg="bg-amber-50"
          title="미접속"
          value={inactive.length}
          sub="발급 후 미사용"
          borderColor="border-l-amber-400"
        />
      </div>

      {/* 검색 + 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, ID, 학과 검색…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
            상태
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={selectedIds.size === 0 || deleting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {deleting ? '삭제 중…' : `삭제${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                </button>
                <button
                  onClick={exitEditMode}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  완료
                </button>
              </>
            ) : (
              <button
                onClick={enterEditMode}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                수정
              </button>
            )}
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {editMode && (
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    className="rounded cursor-pointer accent-blue-600"
                    checked={filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))}
                    onChange={() => toggleSelectAll(filtered.map((e) => e.id))}
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">심사위원</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">아이디</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">학과</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">배정 팀</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">안내 메일</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={editMode ? 8 : 7} className="text-center py-12 text-gray-400">로딩 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={editMode ? 8 : 7} className="text-center py-12 text-gray-400">등록된 심사위원이 없습니다.</td>
              </tr>
            ) : (
              filtered.map((evaluator) => {
                const isActive = !evaluator.status || evaluator.status === 'ACTIVE';
                const color = getAvatarColor(evaluator.email);
                const initial = getInitials(evaluator.email);
                const isSelected = selectedIds.has(evaluator.id);
                return (
                  <tr
                    key={evaluator.id}
                    onClick={editMode ? () => toggleSelect(evaluator.id) : undefined}
                    className={`transition-colors ${editMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {editMode && (
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(evaluator.id)}
                          className="rounded cursor-pointer accent-blue-600"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                          {initial}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {evaluator.name || evaluator.email?.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-400">{evaluator.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-gray-500">{evaluator.email?.split('@')[0]}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{evaluator.department || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{evaluator.assignmentCount ?? '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
                          {isActive ? '활성' : '비활성'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <InvitationStatus invitation={invitations.get(evaluator.id)}
                        pending={retryMutation.isPending} onRetry={() => retryMutation.mutate(evaluator.id)} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      {!editMode && <button className="text-gray-400 hover:text-gray-600 cursor-pointer">···</button>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateEvaluatorModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); setNotice('심사위원 계정이 생성되었습니다. 안내 메일 발송을 대기 중입니다.'); evaluatorsQuery.refetch(); invitationsQuery.refetch(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, iconBg, title, value, sub, borderColor }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} p-5`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
      </div>
    </div>
  );
}

const UsersStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const CheckStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
  </svg>
);
const GridStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const ClockStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const INVITATION_LABELS = {
  PENDING: '발송 대기', PROCESSING: '발송 중', RETRY_WAIT: '재시도 대기',
  SENT: '발송 요청 성공', FAILED: '발송 실패', CANCELLED: '발송 취소', EXPIRED: '발송 기한 만료',
};
const INVITATION_ERRORS = {
  AUTH_REQUIRED: '발신 계정 재연결 필요', PERMISSION_DENIED: '발신 계정 권한 확인 필요',
  RATE_LIMITED: '발송량 제한', DAILY_LIMIT: '일일 발송량 제한', GMAIL_UNAVAILABLE: '메일 서비스 일시 오류',
  NETWORK_ERROR: '네트워크 오류', NETWORK_INTERRUPTED: '네트워크 요청 중단',
  DECRYPTION_FAILED: '메일 설정 확인 필요', ACCOUNT_INACTIVE: '비활성 계정',
  ATTEMPTS_EXHAUSTED: '재시도 횟수 소진', INVALID_REQUEST: '메일 요청 확인 필요',
  INVALID_GMAIL_RESPONSE: '메일 서비스 응답 확인 필요', MESSAGE_ENCODING_ERROR: '메일 작성 오류',
};
function InvitationStatus({ invitation, pending, onRetry }) {
  if (!invitation) return <span className="text-gray-400">발송 이력 없음</span>;
  return <div className="space-y-1">
    <span className={invitation.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}>
      {INVITATION_LABELS[invitation.status] || invitation.status}
    </span>
    {invitation.errorCode && <p className="text-xs text-gray-500">{INVITATION_ERRORS[invitation.errorCode] || '발송 오류'}</p>}
    {invitation.nextAttemptAt && invitation.status === 'RETRY_WAIT' && <p className="text-xs text-gray-400">다음 시도: {new Date(invitation.nextAttemptAt).toLocaleString('ko-KR')}</p>}
    {invitation.retryAllowed && <button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); onRetry(); }} className="block text-xs text-blue-600 disabled:opacity-50">메일 재시도</button>}
  </div>;
}

function CreateEvaluatorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const emailValid = email.includes('@') && email.length > 4;
  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const programs = (programsQuery.data ?? []).filter((program) => program.status !== 'DRAFT');
  const createMutation = useMutation({
    mutationFn: async () => {
      const userRes = await createEvaluator({
        email,
        name: name.trim() || null,
        department: department.trim() || null,
      });
      if (selectedProgramIds.length > 0 && userRes.data?.id) {
        await Promise.all(selectedProgramIds.map((programId) => (
          createAssignment(programId, { evaluatorId: userRes.data.id }).catch(() => {})
        )));
      }
      return userRes;
    },
  });
  const submitting = createMutation.isPending;

  const toggleProgram = (id) => {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return; }
    if (!emailValid) { setError('올바른 이메일 주소를 입력해주세요.'); return; }
    setError('');
    try {
      await createMutation.mutateAsync();
      onCreated();
    } catch (err) {
      const msg = err.response?.status === 409
        ? '이미 등록된 이메일입니다.'
        : err.response?.data?.message || '등록에 실패했습니다.';
      setError(msg);
    } finally {
      // pending state is managed by the mutation.
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">심사위원 계정 생성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* 이름 + 학과 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">학과</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="소프트웨어학과"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 <span className="text-gray-400 font-normal">· 로그인 아이디로 사용</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="judge@skku.edu"
                autoFocus
                className="w-full px-3.5 py-2.5 pr-24 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {emailValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-600 font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  입력 완료
                </span>
              )}
            </div>
          </div>

          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            임시 비밀번호가 자동 생성되어 입력한 이메일로 안내됩니다. 로그인 후 설정 화면에서 변경할 수 있습니다.
          </p>

          {/* 프로그램 배정 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">프로그램 배정</label>
              {programs.length > 0 && (
                <span className="text-xs text-gray-400">
                  {selectedProgramIds.length} / {programs.length}
                </span>
              )}
            </div>
            {programs.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 프로그램이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map((p) => {
                  const selected = selectedProgramIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProgram(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {selected && <span className="mr-1">✓</span>}
                      {p.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? '생성 중...' : '계정 생성 및 메일 예약'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
