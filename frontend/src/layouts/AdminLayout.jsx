import SidebarToggle from '../components/SidebarToggle';
import useSidebarCollapsed from '../query/useSidebarCollapsed';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../api/auth';
import useCurrentUser from '../query/useCurrentUser';
import AdminBreadcrumbContext from '../contexts/AdminBreadcrumbContext';
import './AdminLayout.css';

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const GridIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const TeamIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
// 최고 관리자 전용 항목. MANAGER에게는 노출하지 않는다.
const superAdminNavItems = [
  { path: '/admin/managers', label: '매니저 관리', icon: <ShieldIcon /> },
];
const navItems = [
  { path: '/admin/programs', label: '프로그램', icon: <FolderIcon /> },
  { path: '/admin/teams', label: '팀 관리', icon: <TeamIcon /> },
  { path: '/admin/evaluators', label: '심사위원', icon: <UsersIcon /> },
  { path: '/admin/assignments', label: '심사 배정', icon: <GridIcon /> },
  { path: '/admin/results', label: '결과·내보내기', icon: <ChartIcon /> },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [breadcrumbTarget, setBreadcrumbTarget] = useState(null);
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed('manager');
  const accountTrigger = useRef(null);
  const mobileNavTrigger = useRef(null);
  // 프로그램 상세로 들어올 때 넘어온 state.back이 있으면(예: 결과·내보내기에서 진입) 그 메뉴를 활성 표시한다.
  const activeOverridePath = location.state?.back?.path ?? null;
  const queryClient = useQueryClient();
  const { data: user = {} } = useCurrentUser();
  const logoutMutation = useMutation({ mutationFn: logout, meta: { skipInvalidation: true } });
  const initials = (user.email || 'A').charAt(0).toUpperCase();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const visibleNavItems = isSuperAdmin ? [...superAdminNavItems, ...navItems] : navItems;
  const roleLabel = isSuperAdmin ? 'Super Admin' : 'Manager';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') { setMenuOpen(false); accountTrigger.current?.focus(); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape); };
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
    <AdminBreadcrumbContext.Provider value={breadcrumbTarget}>
    <div className="app-admin-shell flex h-screen bg-gray-50">
      {(
        <header className="app-mobile-bar">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">평가ON</p>
            </div>
          </div>
          <button ref={mobileNavTrigger} aria-expanded={mobileNavOpen} aria-controls="admin-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600">
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            {mobileNavOpen ? '메뉴 닫기' : '메뉴'}
          </button>
        </header>
      )}
      <aside id="admin-navigation"
        onKeyDown={(event) => {
          if (mobileNavOpen && !menuOpen && event.key === 'Escape') {
            setMobileNavOpen(false);
            mobileNavTrigger.current?.focus();
          }
        }}
        className={`admin-sidebar ${sidebarCollapsed ? 'admin-sidebar-collapsed' : ''} w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 ${mobileNavOpen ? 'app-navigation-open' : ''}`}>
        <div className="admin-sidebar-heading px-4 py-2 border-b border-gray-100">
          <div className="admin-sidebar-brand flex items-center gap-2.5">
            <img src="/logo.png" alt="성균관대학교" className="w-8 h-8 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">평가ON</div>
            </div>
          </div>
          <SidebarToggle collapsed={sidebarCollapsed} controls="admin-navigation" onClick={() => { toggleSidebar(); setMenuOpen(false); }} />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          <div>
            <p className="admin-nav-caption text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5">운영</p>
            <div className="space-y-0.5">
              {visibleNavItems.map((item) => {
                if (item.noPage) {
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-500 cursor-default"
                    >
                      {item.icon}
                      {item.label}
                    </div>
                  );
                }
                const isActive = activeOverridePath
                  ? item.path === activeOverridePath
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    to={item.path} aria-label={item.label} title={item.label}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.icon}
                    <span className="admin-nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="admin-nav-caption text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5">시스템</p>
            <button
              aria-label="설정" title="설정"
              onClick={() => { setMobileNavOpen(false); navigate('/admin/settings'); }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors cursor-pointer"
            >
              <SettingsIcon />
              <span className="admin-nav-label">설정</span>
            </button>
          </div>
        </nav>

        <div className="admin-sidebar-account px-3 py-3 border-t border-gray-100">
          <div className="relative" ref={menuRef}>
            <button ref={accountTrigger} aria-label="계정 메뉴" aria-expanded={menuOpen} aria-controls="admin-account-actions"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 w-full px-1.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="admin-account-copy flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{user.email || '관리자'}</div>
                <div className="text-xs text-gray-500">{roleLabel}</div>
              </div>
              {/* 닫힘=∨(아래), 열림=∧(위) */}
              <ChevronIcon className={`admin-account-chevron text-gray-500 flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div id="admin-account-actions" className="admin-account-actions absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-10">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/admin/settings'); }}
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

      <div className="admin-workspace flex-1 flex flex-col min-w-0 min-h-0">
        <header className="admin-breadcrumb-bar">
          <div className="admin-breadcrumb-slot" ref={setBreadcrumbTarget}>
            <nav className="admin-breadcrumb-fallback" aria-label="현재 위치">
              <span>평가ON</span><span aria-hidden="true">›</span>
              <span aria-current="page">{location.pathname.endsWith('/settings') ? '내 계정 설정' : [...superAdminNavItems, ...navItems].find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.label || '프로그램'}</span>
            </nav>
          </div>
        </header>
        <main className="admin-page-content flex-1 overflow-auto min-w-0 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
    </AdminBreadcrumbContext.Provider>
  );
}
