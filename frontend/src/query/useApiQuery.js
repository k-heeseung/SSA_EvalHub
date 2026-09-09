import { useQuery } from '@tanstack/react-query';

export const LIVE_REFETCH_INTERVAL = 30_000;

export function useApiQuery(queryKey, request, options = {}) {
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const response = await request(signal);
      return response.data;
    },
    ...options,
  });
}

export function useLiveApiQuery(queryKey, request, options = {}) {
  return useApiQuery(queryKey, request, {
    refetchInterval: LIVE_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    ...options,
  });
}
