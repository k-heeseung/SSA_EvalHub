import { MutationCache, QueryClient } from '@tanstack/react-query';

let queryClient;

const mutationCache = new MutationCache({
  onSuccess: (_data, _variables, _context, mutation) => {
    if (mutation.options.meta?.skipInvalidation) return undefined;
    const invalidate = mutation.options.meta?.invalidate;
    if (Array.isArray(invalidate) && invalidate.length > 0) {
      return Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    }
    return queryClient.invalidateQueries({ type: 'active' });
  },
});

queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        return ![401, 403, 404].includes(status) && failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
