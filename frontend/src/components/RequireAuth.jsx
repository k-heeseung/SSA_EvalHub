import { Navigate, useLocation } from 'react-router-dom';
import useRealtimeSync from '../query/useRealtimeSync';
import useCurrentUser from '../query/useCurrentUser';

const HOME_BY_ROLE = {
  SUPER_ADMIN: '/admin/programs',
  MANAGER: '/admin/programs',
  EVALUATOR: '/evaluator',
  MEMBER: '/applicant',
};

export default function RequireAuth({ roles, children }) {
  const location = useLocation();
  const { data: user, isPending: loading, isError } = useCurrentUser();
  useRealtimeSync(Boolean(user));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">로그인 확인 중...</div>;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace />;
  }
  return children;
}
