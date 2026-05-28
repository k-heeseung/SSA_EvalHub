import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPrograms } from '../api/programs';
import { getEvaluators } from '../api/evaluators';

export default function DashboardPage() {
  const [programs, setPrograms] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPrograms(), getEvaluators()])
      .then(([programsRes, evaluatorsRes]) => {
        setPrograms(programsRes.data);
        setEvaluators(evaluatorsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activePrograms = programs.filter((p) => p.status === 'ACTIVE');

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-8">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="진행 중인 사업"
          value={activePrograms.length}
          unit="건"
          color="indigo"
          link="/admin/programs"
        />
        <StatCard
          title="등록 심사위원"
          value={evaluators.length}
          unit="명"
          color="emerald"
          link="/admin/evaluators"
        />
        <StatCard
          title="전체 프로그램"
          value={programs.length}
          unit="건"
          color="amber"
          link="/admin/programs"
        />
      </div>

      {/* 최근 사업 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">최근 평가 사업</h2>
          <Link to="/admin/programs" className="text-sm text-indigo-600 hover:underline">
            전체 보기
          </Link>
        </div>

        {programs.length === 0 ? (
          <p className="text-gray-400 text-center py-8">등록된 사업이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {programs.slice(0, 5).map((program) => (
              <div
                key={program.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-800">{program.title}</span>
                  <span className="ml-3 text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                    {program.type}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    program.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {program.status === 'ACTIVE' ? '진행중' : '비활성'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, color, link }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };

  return (
    <Link to={link} className="block">
      <div className={`p-6 rounded-xl border ${colorMap[color]} hover:shadow-md transition-shadow`}>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-3xl font-bold mt-2">
          {value}
          <span className="text-lg font-normal ml-1">{unit}</span>
        </p>
      </div>
    </Link>
  );
}
