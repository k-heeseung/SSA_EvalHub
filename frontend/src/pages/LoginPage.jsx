import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { queryKeys } from '../query/keys';

// 계정의 실제 역할(role)에 따라 이동할 화면을 결정한다.
const ROUTE_BY_ROLE = {
  SUPER_ADMIN: '/admin/programs',
  MANAGER: '/admin/programs',
  EVALUATOR: '/evaluator',
  MEMBER: '/applicant',
};

const ROLES = [
  {
    key: 'manager',
    label: '매니저',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7l9 6 9-6" />
      </svg>
    ),
    route: '/admin/programs',
    role: 'MANAGER',
  },
  {
    key: 'evaluator',
    label: '심사위원',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    route: '/evaluator',
    role: 'EVALUATOR',
  },
  {
    key: 'applicant',
    label: '지원자',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 11l6-6 3.536 3.536-6 6H9v-3.536z" />
      </svg>
    ),
    route: '/applicant',
    role: 'MEMBER',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [roleKey, setRoleKey] = useState(() => {
    const requested = searchParams.get('role');
    return ROLES.some((role) => role.key === requested) ? requested : 'manager';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const loginMutation = useMutation({ mutationFn: login, meta: { skipInvalidation: true } });
  const submitting = loginMutation.isPending;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    try {
      const selectedRole = ROLES.find((role) => role.key === roleKey);
      const { data: account } = await loginMutation.mutateAsync({
        email,
        password,
        role: selectedRole.role,
        rememberMe,
      });
      const route = ROUTE_BY_ROLE[account.role];
      if (!route) {
        setError('로그인할 수 있는 화면이 없는 계정입니다. (관리자에게 문의하세요)');
        return;
      }
      queryClient.setQueryData(queryKeys.currentUser, account);
      navigate(route);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('아이디, 비밀번호 또는 역할이 올바르지 않습니다.');
      } else {
        setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      // pending state is managed by the mutation.
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 좌측 패널 */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-shrink-0 flex-col bg-gradient-to-br from-slate-100 to-blue-50 relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-blue-100/60" />
          <div className="absolute top-1/3 -right-10 w-48 h-48 rounded-full bg-indigo-100/40" />
          <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-blue-50/80" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-8">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain" />
            <div>
              <div className="text-sm font-bold text-gray-800 leading-none">EVALHUB</div>
              <div className="text-[10px] text-gray-500 mt-0.5">SKKU · AI 중심대학사업단</div>
            </div>
          </div>

          {/* 중앙 카피 */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-widest text-blue-500 uppercase mb-4">
              Integrated Evaluation Platform
            </p>
            <h2 className="text-3xl font-bold text-gray-900 leading-snug mb-4">
              지원 접수부터<br />심사·집계까지<br />한 곳에서
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              프로그램 개설, 지원서 수집, 심사위원 배정과 채점, 결과 내보내기를<br />
              하나의 워크플로우로 운영합니다.
            </p>
          </div>

          {/* 카피라이트 */}
          <p className="text-[10px] text-gray-400">
            © 2026 Sungkyunkwan University · AI Convergence University Project
          </p>
        </div>
      </div>

      {/* 우측 폼 패널 */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white">
        <div className="w-full max-w-sm">
          <p className="text-xs font-medium text-blue-600 mb-1">로그인</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">계정으로 시작하기</h1>

          {/* 역할 탭 */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setRoleKey(r.key); setError(''); }}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  roleKey === r.key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* 이메일 */}
            <div>
              <label className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-gray-700">이메일</span>
                <span className="text-xs text-gray-400">이메일이 아이디로 사용됩니다</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">비밀번호</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* 로그인 상태 유지 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">로그인 상태 유지</span>
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* 회원가입 */}
          <div className="mt-5 flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              지원자이신가요? 계정을 만들고 지원하세요.
            </div>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
            >
              회원가입
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m2.014-2.136A9.966 9.966 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-1.993 3.26M6.32 6.32L3 3m18 18l-3.32-3.32M9.88 9.88a3 3 0 104.243 4.243" />
    </svg>
  );
}
