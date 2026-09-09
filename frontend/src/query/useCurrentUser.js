import { useQuery } from '@tanstack/react-query';
import { getSessionUser } from '../api/auth';
import { queryKeys } from './keys';

export default function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async () => (await getSessionUser()).data,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
