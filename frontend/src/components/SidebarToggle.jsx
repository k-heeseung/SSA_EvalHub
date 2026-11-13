export default function SidebarToggle({ collapsed, onClick, controls }) {
  return <button type="button" className="role-sidebar-toggle" onClick={onClick}
    aria-expanded={!collapsed} aria-controls={controls}
    aria-label={collapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d={collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} /></svg>
  </button>;
}
