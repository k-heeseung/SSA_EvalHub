import { useState, useEffect } from 'react';
import { getEvaluators, createEvaluator } from '../api/evaluators';

export default function EvaluatorsPage() {
  const [evaluators, setEvaluators] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEvaluators = () => {
    setLoading(true);
    getEvaluators()
      .then((res) => setEvaluators(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvaluators();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">심사위원</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          + 심사위원 등록
        </button>
      </div>

      {/* 심사위원 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">이메일</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">역할</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : evaluators.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-400">
                  등록된 심사위원이 없습니다.
                </td>
              </tr>
            ) : (
              evaluators.map((evaluator) => (
                <tr key={evaluator.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{evaluator.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{evaluator.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {evaluator.role === 'EVALUATOR' ? '심사위원' : evaluator.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        evaluator.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {evaluator.status === 'ACTIVE' ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 생성 모달 */}
      {showModal && (
        <CreateEvaluatorModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadEvaluators();
          }}
        />
      )}
    </div>
  );
}

function CreateEvaluatorModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    createEvaluator({ email, password })
      .then(() => onCreated())
      .catch((err) => {
        const msg = err.response?.status === 409
          ? '이미 등록된 이메일입니다.'
          : '등록에 실패했습니다.';
        setError(msg);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">심사위원 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="judge@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
