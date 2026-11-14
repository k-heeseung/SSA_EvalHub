import { useRef, useState } from 'react';
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
    if (!window.confirm(`선택한 심사위원 ${selectedIds.size}명\n\n심사위원 계정을 삭제합니다. 로그인과 신규 배정은 차단되며, 기존 평가 기록과 결과는 유지됩니다.`)) return;
    try {
      await deleteMutation.mutateAsync([...selectedIds]);
      exitEditMode();
    } catch {
      alert('삭제에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };


  const searchTerm = search.trim().toLowerCase();
  const filtered = evaluators.filter((e) =>
    !searchTerm || e.email?.toLowerCase().includes(searchTerm) ||
    e.name?.toLowerCase().includes(searchTerm)
  );

  return (
    <div className="ui-page">
      {notice && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {invitationsQuery.isError && <p role="alert" className="mb-4 text-sm text-red-600">메일 발송 상태를 불러오지 못했습니다.</p>}
      {invitationsQuery.data?.creationEnabled === false && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">메일 설정을 준비 중입니다. 설정이 완료되면 심사위원 계정을 생성할 수 있습니다.</p>}
      {invitationsQuery.data?.deliveryEnabled === false && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">메일 발송이 비활성화되어 있습니다. 생성한 계정의 안내 메일은 발송 대기 상태로 보관됩니다.</p>}
      {/* 헤더 */}
      <PageHeader
        breadcrumb={['평가ON', '심사위원']}
        title="심사위원 계정 관리"
        subtitle="전체 심사위원 계정을 생성·관리하고 프로그램별로 배정합니다."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={invitationsQuery.data?.creationEnabled === false}
            onClick={() => setShowModal(true)}
            className="ui-button ui-button--primary flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            + 계정 생성
          </button>
        </div>
      </PageHeader>

      {evaluatorsQuery.isError && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <p>{evaluatorsQuery.data ? '심사위원 목록을 갱신하지 못했습니다. 이전 조회 결과를 표시합니다.' : '심사위원 목록을 불러오지 못했습니다.'}</p>
          <button type="button" className="ui-button ui-button--ghost mt-2" disabled={evaluatorsQuery.isFetching} onClick={() => evaluatorsQuery.refetch()}>{evaluatorsQuery.isFetching ? '재시도 중…' : '다시 불러오기'}</button>
        </div>
      )}
      {/* 검색 + 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 이메일 검색"
              className="ui-input w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={selectedIds.size === 0 || deleting}
                  className="ui-button ui-button--ghost px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {deleting ? '삭제 중…' : `삭제${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                </button>
                <button
                  onClick={exitEditMode}
                  className="ui-button ui-button--ghost px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  완료
                </button>
              </>
            ) : (
              <button
                onClick={enterEditMode}
                className="ui-button ui-button--ghost px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                선택 삭제
              </button>
            )}
          </div>
        </div>

        <div className="ui-table-scroll"><table className="min-w-[40rem] w-full">
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">학과</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">배정 팀</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">안내 메일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={editMode ? 5 : 4} className="text-center py-12 text-gray-500">로딩 중...</td>
              </tr>
            ) : evaluatorsQuery.isError && !evaluatorsQuery.data ? (
              <tr><td colSpan={editMode ? 5 : 4} className="text-center py-12 text-gray-500">위의 재시도 버튼으로 목록을 다시 불러와 주세요.</td></tr>
            ) : filtered.length === 0 && searchTerm ? (
              <tr><td colSpan={editMode ? 5 : 4} className="text-center py-12 text-gray-500">
                <p>검색 결과가 없습니다.</p>
                <button type="button" onClick={() => setSearch('')} className="ui-button ui-button--ghost mt-3">검색 초기화</button>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={editMode ? 5 : 4} className="text-center py-12 text-gray-500">등록된 심사위원이 없습니다.</td>
              </tr>
            ) : (
              filtered.map((evaluator) => {
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
                          <div className="text-xs text-gray-500">{evaluator.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{evaluator.department || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{evaluator.assignmentCount ?? '—'}</td>
                    <td className="px-4 py-4 text-sm">
                      <InvitationStatus invitation={invitations.get(evaluator.id)}
                        pending={retryMutation.isPending} onRetry={() => retryMutation.mutate(evaluator.id)} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table></div>
      </div>

      {showModal && (
        <CreateEvaluatorModal
          onClose={() => setShowModal(false)}
          onCreated={({ failedCount = 0 } = {}) => { if (!failedCount) setShowModal(false); setNotice(failedCount ? `계정은 생성되었지만 프로그램 ${failedCount}건의 배정이 완료되지 않았습니다.` : '심사위원 계정 생성과 요청한 배정이 완료되었습니다. 안내 메일 처리 결과는 목록에서 확인하세요.'); evaluatorsQuery.refetch(); invitationsQuery.refetch(); }}
        />
      )}
    </div>
  );
}

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
  if (!invitation) return <span className="text-gray-500">발송 이력 없음</span>;
  return <div className="space-y-1">
    <span className={invitation.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}>
      {INVITATION_LABELS[invitation.status] || invitation.status}
    </span>
    {invitation.errorCode && <p className="text-xs text-gray-500">{INVITATION_ERRORS[invitation.errorCode] || '발송 오류'}</p>}
    {invitation.nextAttemptAt && invitation.status === 'RETRY_WAIT' && <p className="text-xs text-gray-500">다음 시도: {new Date(invitation.nextAttemptAt).toLocaleString('ko-KR')}</p>}
    {invitation.retryAllowed && <button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); onRetry(); }} className="ui-button ui-button--ghost block text-xs text-blue-600 disabled:opacity-50">메일 재시도</button>}
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
  const [createdAccount, setCreatedAccount] = useState(null);
  const [failedPrograms, setFailedPrograms] = useState([]);
  const requestLock = useRef(false);
  const createMutation = useMutation({
    mutationFn: () => createEvaluator({ email, name: name.trim() || null, department: department.trim() || null }),
  });
  const assignmentMutation = useMutation({
    mutationFn: async ({ evaluatorId, targets }) => {
      const results = await Promise.allSettled(targets.map((program) => createAssignment(program.id, { evaluatorId })));
      return targets.flatMap((program, index) => results[index].status === 'rejected'
        ? [{ ...program, message: results[index].reason?.response?.data?.message || '배정 요청을 완료하지 못했습니다.' }] : []);
    },
  });
  const submitting = createMutation.isPending || assignmentMutation.isPending;

  const toggleProgram = (id) => {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requestLock.current) return;
    if (!createdAccount && !email.trim()) { setError('이메일을 입력해주세요.'); return; }
    if (!createdAccount && !emailValid) { setError('올바른 이메일 주소를 입력해주세요.'); return; }
    requestLock.current = true;
    setError('');
    try {
      const account = createdAccount || (await createMutation.mutateAsync()).data || { email };
      if (!createdAccount) setCreatedAccount(account);
      const targets = createdAccount ? failedPrograms : programs.filter((program) => selectedProgramIds.includes(program.id));
      if (targets.length && !account?.id) {
        setFailedPrograms(targets);
        setError('계정은 생성되었지만 계정 식별자를 확인하지 못해 배정할 수 없습니다. 목록을 새로 확인해주세요.');
        onCreated({ failedCount: targets.length });
        return;
      }
      const failed = targets.length ? await assignmentMutation.mutateAsync({ evaluatorId: account.id, targets }) : [];
      setFailedPrograms(failed);
      onCreated({ failedCount: failed.length });
    } catch (err) {
      setError(err.response?.status === 409 ? '이미 등록된 이메일입니다.' : err.response?.data?.message || '등록에 실패했습니다.');
    } finally {
      requestLock.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">심사위원 계정 생성</h2>
          <button disabled={submitting} onClick={onClose} className="ui-button ui-button--ghost text-gray-500 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {createdAccount && <div role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">계정 생성은 완료되었습니다.</p>
            <p>다음 프로그램은 배정되지 않았습니다. 실패한 배정만 다시 시도할 수 있습니다.</p>
            <ul className="mt-2 space-y-2">{failedPrograms.map((program) => <li key={program.id}><strong>{program.title}</strong><p>{program.message}</p></li>)}</ul>
          </div>}
          <fieldset hidden={Boolean(createdAccount)} disabled={submitting || Boolean(createdAccount)} className="space-y-5">
          {/* 이름 + 학과 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="ui-input w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">학과</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="소프트웨어학과"
                className="ui-input w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 <span className="text-gray-500 font-normal">· 로그인 아이디로 사용</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="judge@skku.edu"
                autoFocus
                className="ui-input w-full px-3.5 py-2.5 pr-24 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
            <div className="flex flex-wrap gap-3 items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">프로그램 배정</label>
              {programs.length > 0 && (
                <span className="text-xs text-gray-500">
                  {selectedProgramIds.length} / {programs.length}
                </span>
              )}
            </div>
            {programsQuery.isPending ? <p className="text-sm text-gray-500">프로그램을 불러오는 중입니다.</p> : programsQuery.isError ? (
              <div role="alert" className="text-sm text-red-700"><p>프로그램 목록을 불러오지 못했습니다. 배정을 원하면 먼저 다시 불러와 주세요.</p>
                <button type="button" className="ui-button ui-button--ghost mt-2" onClick={() => programsQuery.refetch()} disabled={programsQuery.isFetching}>다시 불러오기</button>
              </div>
            ) : programs.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 프로그램이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map((p) => {
                  const selected = selectedProgramIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProgram(p.id)}
                      className={`ui-button ui-button--ghost px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
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

          </fieldset>
          {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="ui-button ui-button--ghost flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {createdAccount ? '닫기' : '취소'}
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(createdAccount && !createdAccount.id)}
              className="ui-button ui-button--primary flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (createdAccount ? '배정 중…' : '생성 중…') : createdAccount ? '실패한 배정 재시도' : '계정 생성 및 메일 예약'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
