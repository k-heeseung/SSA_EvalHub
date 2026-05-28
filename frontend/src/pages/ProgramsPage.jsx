import { useState, useEffect } from 'react';
import { getPrograms, createProgram } from '../api/programs';

const TABS = [
  { key: 'ALL', label: '전체' },
  { key: 'ACTIVE', label: '진행중' },
  { key: 'SCHEDULED', label: '예정' },
  { key: 'COMPLETED', label: '완료' },
  { key: 'ARCHIVED', label: '보관' },
];

const TYPE_LABELS = {
  MODULE_A: 'Module A',
  MODULE_B: 'Module B',
  MODULE_C: 'Module C',
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPrograms = () => {
    setLoading(true);
    getPrograms()
      .then((res) => setPrograms(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  // 현재 백엔드에 status 필터 종류가 ACTIVE/INACTIVE만 있으므로 매핑
  const filteredPrograms =
    activeTab === 'ALL'
      ? programs
      : programs.filter((p) => {
          if (activeTab === 'ACTIVE') return p.status === 'ACTIVE';
          if (activeTab === 'ARCHIVED') return p.status === 'INACTIVE';
          // SCHEDULED, COMPLETED는 아직 백엔드에 없으므로 빈 목록
          return false;
        });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">평가 사업</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          + 사업 등록
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 사업 목록 */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg">해당하는 사업이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrograms.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showModal && (
        <CreateProgramModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadPrograms();
          }}
        />
      )}
    </div>
  );
}

function ProgramCard({ program }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
          {TYPE_LABELS[program.type] || program.type}
        </span>
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
      <h3 className="font-semibold text-gray-800 text-lg mb-2">{program.title}</h3>
      <p className="text-sm text-gray-500 line-clamp-2">
        {program.description || '설명이 없습니다.'}
      </p>
    </div>
  );
}

function CreateProgramModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('MODULE_A');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('사업명을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    createProgram({ title, description, type, managerId: null })
      .then(() => onCreated())
      .catch((err) => setError(err.response?.data?.message || '생성에 실패했습니다.'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">새 평가 사업 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사업명</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026 캡스톤 디자인 평가"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="사업에 대한 설명을 입력하세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="MODULE_A">Module A</option>
              <option value="MODULE_B">Module B</option>
              <option value="MODULE_C">Module C</option>
            </select>
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
