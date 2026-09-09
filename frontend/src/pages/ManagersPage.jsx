import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { getManagers, createManager, deleteManager } from '../api/managers';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';
import useCurrentUser from '../query/useCurrentUser';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];

function getAvatarColor(email = '') {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(email = '') {
  return email.charAt(0).toUpperCase();
}

export default function ManagersPage() {
  const { data: user, isPending: userLoading } = useCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const managersQuery = useLiveApiQuery(queryKeys.managers, () => getManagers(), {
    enabled: isSuperAdmin,
  });
  const managers = managersQuery.data ?? [];
  const loading = managersQuery.isPending;
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => deleteManager(id))),
  });
  const deleting = deleteMutation.isPending;

  // 최고 관리자 전용 화면. 그 외 역할은 프로그램 목록으로 되돌린다.
  if (!userLoading && !isSuperAdmin) {
    return <Navigate to="/admin/programs" replace />;
  }

  const enterEditMode = () => { setEditMode(true); setSelectedIds(new Set()); };
  const exitEditMode = () => { setEditMode(false); setSelectedIds(new Set()); };

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
      return allSelected ? new Set() : new Set(ids);
    });
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 매니저 ${selectedIds.size}명을 삭제하시겠습니까?`)) return;
    try {
      await deleteMutation.mutateAsync([...selectedIds]);
      exitEditMode();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const active = managers.filter((m) => m.status === 'ACTIVE' || !m.status);
  const inactive = managers.filter((m) => m.status && m.status !== 'ACTIVE');
  const totalPrograms = managers.reduce((sum, m) => sum + (m.assignmentCount ?? 0), 0);

  const filtered = managers.filter((m) =>
    !search || m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <PageHeader
        breadcrumb={['EvalHub', '매니저']}
        title="매니저 계정 관리"
        subtitle="프로그램 운영을 담당할 매니저 계정을 생성·관리합니다."
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
        >
          + 계정 생성
        </button>
      </PageHeader>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<ShieldStatIcon className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="전체 매니저"
          value={managers.length}
          sub={`활성 ${active.length} · 비활성 ${inactive.length}`}
          borderColor="border-l-blue-400"
        />
        <StatCard
          icon={<CheckStatIcon className="text-green-500" />}
          iconBg="bg-green-50"
          title="활성 계정"
          value={active.length}
          sub="로그인 가능"
          borderColor="border-l-green-400"
        />
        <StatCard
          icon={<FolderStatIcon className="text-purple-500" />}
          iconBg="bg-purple-50"
          title="담당 프로그램"
          value={totalPrograms}
          sub="전체 담당 합계"
          borderColor="border-l-purple-400"
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
              placeholder="이름, 이메일 검색…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
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
                    checked={filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id))}
                    onChange={() => toggleSelectAll(filtered.map((m) => m.id))}
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">매니저</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">이메일</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">학과·소속</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">담당 프로그램</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={editMode ? 7 : 6} className="text-center py-12 text-gray-400">로딩 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={editMode ? 7 : 6} className="text-center py-12 text-gray-400">등록된 매니저가 없습니다.</td>
              </tr>
            ) : (
              filtered.map((manager) => {
                const isActive = !manager.status || manager.status === 'ACTIVE';
                const color = getAvatarColor(manager.email);
                const initial = getInitials(manager.email);
                const isSelected = selectedIds.has(manager.id);
                return (
                  <tr
                    key={manager.id}
                    onClick={editMode ? () => toggleSelect(manager.id) : undefined}
                    className={`transition-colors ${editMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {editMode && (
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(manager.id)}
                          className="rounded cursor-pointer accent-blue-600"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                          {initial}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {manager.name || manager.email?.split('@')[0]}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">{manager.email}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{manager.department || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{manager.assignmentCount ?? 0}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
                          {isActive ? '활성' : '비활성'}
                        </span>
                      </div>
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
        <CreateManagerModal
          onClose={() => setShowModal(false)}
          onCreated={() => setShowModal(false)}
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

const ShieldStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const CheckStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
  </svg>
);
const FolderStatIcon = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CreateManagerModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [randomPassword, setRandomPassword] = useState(() => generateRandomPassword());
  const [error, setError] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [copied, setCopied] = useState(false);
  const emailValid = email.includes('@') && email.length > 4;
  const createMutation = useMutation({
    mutationFn: () => createManager({
      email,
      password: randomPassword,
      name: name.trim() || null,
      department: department.trim() || null,
    }),
  });
  const submitting = createMutation.isPending;

  const regenerate = () => setRandomPassword(generateRandomPassword());

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">매니저 계정 생성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">학과·소속</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="AI중심대학사업단"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 <span className="text-gray-400 font-normal">· 로그인 아이디로 사용</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@skku.edu"
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">임시 비밀번호</label>
              <button
                type="button"
                onClick={regenerate}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                재발급
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <span className="px-3 py-2.5 text-xs font-medium text-gray-400 bg-gray-100 border-r border-gray-200 flex-shrink-0 w-20 text-center">비밀번호</span>
                <span className="flex-1 px-3 py-2.5 text-sm font-mono text-gray-700 truncate">{randomPassword}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(randomPassword)}
                  className="px-3 py-2.5 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer flex-shrink-0 border-l border-gray-200"
                  title="복사"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                계정 정보는 이메일로 자동 전송됩니다. 첫 로그인 시 비밀번호 변경이 권장됩니다.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <span className="text-sm text-gray-700">계정 생성 후 즉시 안내 메일 발송</span>
          </label>

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
              {submitting ? '생성 중...' : '생성 및 발송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
