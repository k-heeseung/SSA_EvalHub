import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvaluators, getAssignmentsByEvaluator } from '../api/evaluators';

export default function EvaluatorDashboardPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        // 심사위원 목록에서 현재 로그인한 이메일과 일치하는 심사위원 찾기
        const evaluatorsRes = await getEvaluators();
        const me = evaluatorsRes.data.find((e) => e.email === user.email);

        if (!me) {
          setError('심사위원 계정을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        const res = await getAssignmentsByEvaluator(me.id);
        setAssignments(res.data);
      } catch (err) {
        setError('배정 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, []);

  const getStatusBadge = (status) => {
    const map = {
      ASSIGNED: { label: '배정됨', style: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { label: '진행중', style: 'bg-yellow-100 text-yellow-700' },
      SUBMITTED: { label: '제출완료', style: 'bg-green-100 text-green-700' },
      CANCELED: { label: '취소됨', style: 'bg-gray-100 text-gray-500' },
    };
    const info = map[status] || { label: status, style: 'bg-gray-100 text-gray-500' };
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${info.style}`}>
        {info.label}
      </span>
    );
  };

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm cursor-pointer"
        >
          다시 로그인
        </button>
      </div>
    );
  }

  const pending = assignments.filter((a) => a.status !== 'SUBMITTED');
  const completed = assignments.filter((a) => a.status === 'SUBMITTED');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">내 평가 목록</h1>
      <p className="text-gray-500 mb-8">배정된 평가 대상을 확인하고 채점하세요.</p>

      {assignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg">배정된 평가가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 미완료 평가 */}
          {pending.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                진행 중 ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    getStatusBadge={getStatusBadge}
                    onEvaluate={() => navigate(`/evaluator/evaluate/${assignment.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 완료된 평가 */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                제출 완료 ({completed.length})
              </h2>
              <div className="space-y-3">
                {completed.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    getStatusBadge={getStatusBadge}
                    onEvaluate={() => navigate(`/evaluator/evaluate/${assignment.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AssignmentCard({ assignment, getStatusBadge, onEvaluate }) {
  return (
    <div className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
      <div>
        <h3 className="font-semibold text-gray-800">{assignment.participantName}</h3>
        <p className="text-sm text-gray-500 mt-1">프로그램 ID: {assignment.programId}</p>
      </div>
      <div className="flex items-center gap-4">
        {getStatusBadge(assignment.status)}
        <button
          onClick={onEvaluate}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            assignment.status === 'SUBMITTED'
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {assignment.status === 'SUBMITTED' ? '결과 보기' : '채점하기'}
        </button>
      </div>
    </div>
  );
}
