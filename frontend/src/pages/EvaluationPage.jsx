import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvaluationView, saveDraft, submitEvaluation } from '../api/evaluations';

export default function EvaluationPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState(null);
  const [scores, setScores] = useState({}); // { criterionId: score }
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvaluationView(assignmentId)
      .then((res) => {
        setView(res.data);
        // 기존 임시저장 데이터가 있으면 불러오기
        if (res.data.submission) {
          const existingScores = {};
          res.data.submission.scores.forEach((s) => {
            existingScores[s.criterionId] = s.score;
          });
          setScores(existingScores);
          setComment(res.data.submission.oneLineComment || '');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const handleScoreChange = (criterionId, value) => {
    const num = parseFloat(value);
    if (value === '' || (num >= 0 && num <= 10)) {
      setScores({ ...scores, [criterionId]: value === '' ? '' : num });
    }
  };

  const buildRequest = () => ({
    scores: Object.entries(scores)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([criterionId, score]) => ({
        criterionId: Number(criterionId),
        score: Number(score),
      })),
    oneLineComment: comment || null,
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage('');
    try {
      await saveDraft(assignmentId, buildRequest());
      setMessage('임시저장 되었습니다.');
    } catch (err) {
      setMessage(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('제출하면 수정할 수 없습니다. 제출하시겠습니까?')) return;

    setSubmitting(true);
    setMessage('');
    try {
      await submitEvaluation(assignmentId, buildRequest());
      setMessage('제출 완료!');
      setTimeout(() => navigate('/evaluator'), 1500);
    } catch (err) {
      setMessage(err.response?.data?.message || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  if (!view) {
    return <div className="text-red-500">평가 정보를 불러올 수 없습니다.</div>;
  }

  const isSubmitted = view.submission?.status === 'SUBMITTED';

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <button
        onClick={() => navigate('/evaluator')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
      >
        &larr; 목록으로 돌아가기
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h1 className="text-xl font-bold text-gray-800">{view.team.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{view.program.title}</p>
        {view.team.description && (
          <p className="text-sm text-gray-600 mt-3 p-3 bg-gray-50 rounded-lg">
            {view.team.description}
          </p>
        )}
        {isSubmitted && (
          <div className="mt-3 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg">
            이 평가는 이미 제출되었습니다. (총점: {view.submission.totalScore}점)
          </div>
        )}
      </div>

      {/* PDF 첨부파일 */}
      {view.attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">첨부 자료</h2>
          <div className="space-y-2">
            {view.attachments.map((att) => (
              <a
                key={att.id}
                href={att.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm text-indigo-600"
              >
                <span>📄</span>
                {att.originalFilename}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 채점 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">평가 항목</h2>

        <div className="space-y-6">
          {view.criteria.map((criterion, index) => (
            <div key={criterion.id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-indigo-600 mr-2">
                    Q{index + 1}.
                  </span>
                  <span className="font-medium text-gray-800">{criterion.name}</span>
                </div>
                <span className="text-xs text-gray-400">0~{criterion.maxScore}점</span>
              </div>
              {criterion.description && (
                <p className="text-sm text-gray-500 mb-3 ml-7">{criterion.description}</p>
              )}
              <div className="ml-7">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={scores[criterion.id] ?? ''}
                  onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                  disabled={isSubmitted}
                  placeholder="점수 입력"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 한줄평 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">한줄평</h2>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isSubmitted}
          maxLength={500}
          placeholder="평가 대상에 대한 한줄 코멘트를 남겨주세요"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/500</p>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.includes('실패') || message.includes('must')
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-600'
          }`}
        >
          {message}
        </div>
      )}

      {/* 버튼 */}
      {!isSubmitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? '저장 중...' : '임시저장'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? '제출 중...' : '최종 제출'}
          </button>
        </div>
      )}
    </div>
  );
}
