import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import useCurrentUser from '../query/useCurrentUser';
import './RoleLayouts.css';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('evalhub.evaluator.sidebarCollapsed') === 'true'; } catch { return false; }
  });
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    setMenuOpen(false);
    try { localStorage.setItem('evalhub.evaluator.sidebarCollapsed', String(next)); } catch { /* The control still works when storage is unavailable. */ }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTrigger = useRef(null);
  const accountTrigger = useRef(null);
  const logoutGuardRef = useRef(null);
  const registerLogoutGuard = useCallback((guard) => { logoutGuardRef.current = guard; }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const performLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };
  const handleLogout = () => {
    if (logoutGuardRef.current) logoutGuardRef.current(performLogout);
    else void performLogout();
  };

  return (
    <div className="evaluator-shell flex h-screen bg-gray-50">
      <header className="role-mobile-bar">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain" />
          <div><div className="text-sm font-bold text-gray-900">평가ON</div><div className="text-xs text-gray-500">심사위원 콘솔</div></div>
        </div>
        <button ref={mobileNavTrigger} className="role-mobile-toggle ui-button" aria-expanded={mobileNavOpen} aria-controls="evaluator-navigation" onClick={() => setMobileNavOpen((open) => !open)}>
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          {mobileNavOpen ? '메뉴 닫기' : '메뉴'}
        </button>
      </header>
      <aside id="evaluator-navigation" onKeyDown={(event) => {
        if (event.key === 'Escape' && !menuOpen) {
          setMobileNavOpen(false);
          mobileNavTrigger.current?.focus();
        }
      }} className={`evaluator-sidebar ${sidebarCollapsed ? 'evaluator-sidebar-collapsed' : ''} ${mobileNavOpen ? 'role-navigation-open' : ''} w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0`}>
        <div className="evaluator-sidebar-heading px-4 py-4 border-b border-gray-100">
          <div className="evaluator-brand flex items-center gap-2.5">
            <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">평가ON</div>
              <div className="text-xs text-gray-500">심사위원 콘솔</div>
            </div>
          </div>
          <button type="button" className="evaluator-collapse-toggle" onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed} aria-controls="evaluator-navigation"
            aria-label={sidebarCollapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'} title={sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d={sidebarCollapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="evaluator-nav-caption text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5">심사</p>
          <div className="space-y-0.5">
            <NavLink
              to="/evaluator" aria-label="내 심사" title="내 심사"
              onClick={() => { setMobileNavOpen(false); setMenuOpen(false); }}
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
              <span className="evaluator-nav-label">내 심사</span>
            </NavLink>
          </div>
        </nav>

        <div className="evaluator-sidebar-account px-3 py-3 border-t border-gray-100">
          <div className="relative" ref={menuRef}>
            <button
              ref={accountTrigger}
              aria-expanded={menuOpen}
              aria-controls="evaluator-account-actions"
              aria-label="계정 메뉴"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 w-full px-1.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="evaluator-account-copy flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{user.email || '심사위원'}</div>
                <div className="text-xs text-gray-500">심사위원</div>
              </div>
              {/* 닫힘=∨(아래), 열림=∧(위) */}
              <ChevronIcon className={`evaluator-account-chevron text-gray-500 flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div id="evaluator-account-actions" className="role-account-actions absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-10">
                <button
                  onClick={() => { setMenuOpen(false); setMobileNavOpen(false); navigate('/evaluator/settings'); }}
                  className="role-account-action flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <SettingsIcon />
                  설정
                </button>
                <button
                  onClick={handleLogout}
                  className="role-account-action flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 cursor-pointer"
                >
                  <LogoutIcon />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="evaluator-main flex-1 overflow-hidden flex flex-col">
        <Outlet context={registerLogoutGuard} />
      </main>
    </div>
  );
}
