import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import useCurrentUser from '../query/useCurrentUser';

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
// 기본 방향은 아래(∨). rotate 클래스로 방향과 애니메이션을 제어한다.
const ChevronIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
export default function EvaluatorLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user = {} } = useCurrentUser();
  const logoutMutation = useMutation({ mutationFn: logout, meta: { skipInvalidation: true } });
  const initials = (user.email || 'E').charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">EvalHub</div>
              <div className="text-xs text-gray-400">심사위원 콘솔</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">심사</p>
          <div className="space-y-0.5">
            <NavLink
              to="/evaluator"
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <ClipboardIcon />
              내 심사
            </NavLink>
          </div>
        </nav>

        <div className="px-3 py-3 border-t border-gray-100">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 w-full px-1.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{user.email || '심사위원'}</div>
                <div className="text-xs text-gray-400">심사위원</div>
              </div>
              {/* 닫힘=∨(아래), 열림=∧(위) */}
              <ChevronIcon className={`text-gray-400 flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-10">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/evaluator/settings'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <SettingsIcon />
                  설정
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 cursor-pointer"
                >
                  <LogoutIcon />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
