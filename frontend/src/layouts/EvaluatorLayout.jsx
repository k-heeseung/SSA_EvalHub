import { Outlet, useNavigate } from 'react-router-dom';

export default function EvaluatorLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">EvalHub</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email || '심사위원'}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
