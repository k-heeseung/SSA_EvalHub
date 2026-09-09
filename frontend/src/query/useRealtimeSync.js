import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function useRealtimeSync(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const events = new EventSource('/api/events', { withCredentials: true });
    const handleChange = () => {
      queryClient.invalidateQueries({ type: 'active' });
    };
    events.addEventListener('change', handleChange);

    return () => {
      events.removeEventListener('change', handleChange);
      events.close();
    };
  }, [enabled, queryClient]);
}
