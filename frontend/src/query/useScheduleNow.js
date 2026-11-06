import { useEffect, useState } from 'react';

// Keep manager filters, ordering and period locks current while a page stays open.
export function useScheduleNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 1000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  return now;
}
