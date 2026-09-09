import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../api/auth';
import useCurrentUser from '../query/useCurrentUser';

const ROLE_LABEL = {
  SUPER_ADMIN: '최고 관리자',
  MANAGER: '매니저',
  EVALUATOR: '심사위원',
  MEMBER: '지원자',
};

// 매니저·심사위원·지원자·관리자 공용 '내 계정 설정' 화면.
// 기본 정보를 보여주고, '비밀번호 변경'을 누르면 모달에서 변경한다.
export default function SettingsPage() {
  const { data: user = {} } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const info = [
    { label: '이름', value: user.name || '—' },
    { label: '이메일', value: user.email || '—' },
    { label: '소속', value: user.department || '—' },
    { label: '역할', value: ROLE_LABEL[user.role] || user.role || '—' },
  ];

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">내 계정 설정</h1>
      <p className="text-sm text-gray-500 mb-6">계정 정보를 확인하고 비밀번호를 변경할 수 있습니다.</p>

      {savedMsg && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {savedMsg}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
        <div className="divide-y divide-gray-50">
          {info.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium text-gray-800">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 계정 관리 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">계정 관리</h2>
        </div>
        <button
          onClick={() => { setSavedMsg(''); setOpen(true); }}
          className="flex items-center gap-3 w-full px-5 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
        >
          <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-800">비밀번호 변경</span>
            <span className="block text-xs text-gray-400">현재 비밀번호 확인 후 새 비밀번호로 변경</span>
          </span>
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {open && (
        <ChangePasswordModal
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); setSavedMsg('비밀번호가 변경되었습니다.'); }}
        />
      )}
    </div>
  );
}

function ChangePasswordModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess,
    onError: (err) => {
      const status = err.response?.status;
      // 길이·일치·동일 여부는 아래에서 선검증하므로, 서버 400은 사실상 '현재 비밀번호 불일치'다.
      if (status === 400) {
        setError('현재 비밀번호가 올바르지 않습니다.');
      } else if (status === 401) {
        setError('로그인이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        setError('비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.current || !form.next || !form.confirm) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (form.next.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.next === form.current) {
      setError('새 비밀번호가 기존 비밀번호와 동일합니다.');
      return;
    }
    mutation.mutate();
  };

  const inputClass =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">비밀번호 변경</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">현재 비밀번호</label>
          <input type="password" value={form.current} onChange={set('current')} autoComplete="current-password" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호 <span className="text-gray-400 font-normal">· 8자 이상</span></label>
          <input type="password" value={form.next} onChange={set('next')} autoComplete="new-password" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호 확인</label>
          <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" className={inputClass} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {mutation.isPending ? '변경 중...' : '변경'}
          </button>
        </div>
      </form>
    </div>
  );
}
