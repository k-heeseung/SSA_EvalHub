import { useState } from 'react';

export default function useSidebarCollapsed(role) {
  const key = `evalhub.${role}.sidebarCollapsed`;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  });
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(key, String(next)); } catch { /* Remain usable without storage. */ }
  };
  return [collapsed, toggle];
}
