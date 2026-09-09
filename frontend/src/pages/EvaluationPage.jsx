import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getEvaluationView, saveDraft, submitEvaluation } from '../api/evaluations';
import { FIELD_TYPE_LABEL, normalizeFieldType, parseCheckboxValue, isFileType } from '../utils/formFields';
import TeamMemberList from '../components/TeamMemberList';
import { formatPhone } from '../utils/phone';

// pdfjs 번들이 크므로 평가 화면에서 뷰어를 열 때만 로드한다.
const PdfViewer = lazy(() => import('../components/PdfViewer'));
import { queryKeys } from '../query/keys';
import { useApiQuery } from '../query/useApiQuery';

const LEFT_TABS = ['발표 자료', '지원서 정보', '팀 정보'];
const AUTOSAVE_DELAY = 3000;

const snapshotOf = (scores, comment) => JSON.stringify({ scores, comment });

// 제출된 답변을 읽기 좋은 문자열로 변환 (체크박스는 JSON 배열로 저장됨)
function displayAnswer(field) {
  if (normalizeFieldType(field.fieldType) === 'CHECKBOX') {
    return parseCheckboxValue(field.value).join(', ');
  }
  return field.value || '';
}

export default function EvaluationPage() {
  const { assignmentId, teamId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const queryClient = useQueryClient();
  const hydratedViewRef = useRef(null);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [leftTab, setLeftTab] = useState(0);
  const [pdfIndex, setPdfIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false);
  const [leaveAction, setLeaveAction] = useState(null);
  const [scoringOpen, setScoringOpen] = useState(true);
  const autosaveTimerRef = useRef(null);
  const viewQuery = useApiQuery(
    queryKeys.evaluationView(assignmentId, teamId),
    () => getEvaluationView(assignmentId, teamId),
  );
  const view = viewQuery.data ?? null;
  const loading = viewQuery.isPending;
  const draftMutation = useMutation({
    mutationFn: (payload) => saveDraft(assignmentId, teamId, payload),
  });
  const submitMutation = useMutation({
    mutationFn: (payload) => submitEvaluation(assignmentId, teamId, payload),
  });
  const saving = draftMutation.isPending;
  const submitting = submitMutation.isPending;

  const teams = state?.teams || [];
  const programTitle = state?.programTitle;
  const programId = state?.programId;
  const currentIndex = teams.findIndex((t) => t.teamId === Number(teamId));
  const prevTeam = currentIndex > 0 ? teams[currentIndex - 1] : null;
  const nextTeam = currentIndex < teams.length - 1 ? teams[currentIndex + 1] : null;

  const isSubmitted = view?.submission?.status === 'SUBMITTED';
  const evaluationStart = view?.program?.evaluationStart;
  const todayStr = new Date().toISOString().slice(0, 10);
  const beforeStart = !isSubmitted && !!evaluationStart && todayStr < evaluationStart;
  // 마지막 저장/로드 시점 대비 변경 여부. 저장 스냅샷이 아직 없으면(로딩 중) 변경 없음으로 본다.
  const dirty = savedSnapshot !== null && snapshotOf(scores, comment) !== savedSnapshot;

  useEffect(() => {
    const hydrationKey = `${assignmentId}:${teamId}`;
    if (!view || hydratedViewRef.current === hydrationKey) return;
    hydratedViewRef.current = hydrationKey;
    const loadedScores = {};
    let loadedComment = '';
    if (view.submission?.scores) {
      view.submission.scores.forEach((score) => { loadedScores[score.criterionId] = score.score; });
      loadedComment = view.submission.oneLineComment || '';
    }
    setScores(loadedScores);
    setComment(loadedComment);
    setPdfIndex(0);
    setSavedSnapshot(snapshotOf(loadedScores, loadedComment));
    setLastSavedAt(null);
    setIsEditingSubmitted(false);
  }, [assignmentId, teamId, view]);

  // 저장하지 않은 변경사항이 있는 채로 창을 닫으려 하면 경고한다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleScoreChange = (criterionId, value) => {
    setScores((prev) => ({ ...prev, [criterionId]: value }));
  };

  const buildRequest = () => ({
    scores: Object.entries(scores)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([criterionId, score]) => ({ criterionId: Number(criterionId), score: Number(score) })),
    oneLineComment: comment || null,
  });

  const persistDraft = async ({ silent = false } = {}) => {
    if (saving || submitting) return;
    if (!silent) setMessage('');
    try {
      await draftMutation.mutateAsync(buildRequest());
      setSavedSnapshot(snapshotOf(scores, comment));
      setLastSavedAt(new Date());
      if (!silent) setMessage('임시저장 되었습니다.');
    } catch (err) {
      if (!silent) setMessage(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  const handleSaveDraft = () => persistDraft({ silent: false });

  // 변경사항이 있으면 일정 시간 후 자동으로 임시저장한다. (제출 완료 상태는 제외)
  useEffect(() => {
    if (loading || isSubmitted || beforeStart || !dirty || saving || submitting) return;
    autosaveTimerRef.current = setTimeout(() => { persistDraft({ silent: true }); }, AUTOSAVE_DELAY);
    return () => clearTimeout(autosaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, comment, dirty, loading, isSubmitted, beforeStart, saving, submitting]);

  const handleSubmit = async () => {
    const isSubmittedEdit = isSubmitted && isEditingSubmitted;
    setMessage('');
    try {
      const res = await submitMutation.mutateAsync(buildRequest());
      queryClient.setQueryData(queryKeys.evaluationView(assignmentId, teamId), (current) => ({
        ...current,
        submission: res.data,
      }));
      setSavedSnapshot(snapshotOf(scores, comment));
      setLastSavedAt(new Date());
      setIsEditingSubmitted(false);
      setMessage(isSubmittedEdit ? '평가 수정이 완료되었습니다.' : '평가 제출이 완료되었습니다.');
    } catch (err) {
      setMessage(err.response?.data?.message || '제출에 실패했습니다.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  const handleCancelSubmittedEdit = () => {
    if (dirty && !window.confirm('수정한 내용을 취소하시겠어요?')) return;
    if (savedSnapshot) {
      const saved = JSON.parse(savedSnapshot);
      setScores(saved.scores);
      setComment(saved.comment);
    }
    setIsEditingSubmitted(false);
    setMessage('');
  };

  // 저장되지 않은 변경사항이 있으면 이동 전에 앱 내 확인창을 띄운다. 없으면 바로 이동한다.
  // 나가기/이전·다음 버튼을 누르는 즉시 대기 중인 자동 임시저장을 멈춰서,
  // 확인창이 떠 있는 동안 뒤에서 자동저장이 몰래 실행되는 걸 막는다.
  const requestLeave = (action) => {
    clearTimeout(autosaveTimerRef.current);
    if (!dirty) { action(); return; }
    setLeaveAction(() => action);
  };

  // '저장하지 않고 나가기'를 선택하면 그대로 이동한다. (자동저장은 이미 requestLeave에서 멈췄다)
  const confirmLeave = () => {
    clearTimeout(autosaveTimerRef.current);
    const action = leaveAction;
    setLeaveAction(null);
    action?.();
  };

  const cancelLeave = () => setLeaveAction(null);

  const navigateToTeam = (team) => {
    requestLeave(() => {
      setMessage('');
      setLeftTab(0);
      navigate(`/evaluator/evaluate/${assignmentId}/teams/${team.teamId}`, {
        state: { teams, programTitle, programId },
      });
    });
  };

  const goToTeamList = () => {
    requestLeave(() => {
      navigate(`/evaluator/evaluate/${assignmentId}/teams`, {
        state: { programId, programTitle },
      });
    });
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  if (!view)
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-500">평가 정보를 불러올 수 없습니다.</p>
      </div>
    );

  const isDraft = view.submission && !isSubmitted;
  const criteria = view.criteria || [];
  const scoredCount = criteria.filter((c) => scores[c.id] !== undefined && scores[c.id] !== '').length;
  const totalScore = criteria.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);
  const maxTotal = criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0);
  const allScored = scoredCount === criteria.length && criteria.length > 0;
  const files = view.attachments || [];
  const activePdfIndex = Math.min(pdfIndex, Math.max(0, files.length - 1));
  const isSubmittedReadOnly = isSubmitted && !isEditingSubmitted;
  const isReadOnly = isSubmittedReadOnly || beforeStart;

  // 지원자가 제출한 지원서 정보
  const application = view.application;
  const appInfo = application?.applicantInfo || {};
  const isTeamApp = application?.participantType === 'TEAM';
  const answerFields = (application?.fields || []).filter((f) => !isFileType(f.fieldType));

  return (
    <div className="h-full flex flex-col">
      {/* 상단 네비게이션 바 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center h-12 px-4 gap-3">
        <button
          onClick={goToTeamList}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          팀 목록
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800">#{String(currentIndex + 1).padStart(2, '0')} {view.team.name}</span>
          {isDraft && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              임시저장 불러옴
            </span>
          )}
          {isSubmitted && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              제출됨
            </span>
          )}
          {beforeStart && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
              평가 시작 전
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {teams.length > 1 && (
            <span className="text-sm text-gray-400">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${teams.length}` : ''} 팀
            </span>
          )}
          {prevTeam && (
            <button
              onClick={() => navigateToTeam(prevTeam)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              이전
            </button>
          )}
          {nextTeam && (
            <button
              onClick={() => navigateToTeam(nextTeam)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              다음
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {(prevTeam || nextTeam) && <div className="w-px h-5 bg-gray-200" />}

          {/* 채점 패널 접기: 전체화면 대신 자료 뷰어를 384px 넓히는 수단 */}
          <button
            onClick={() => setScoringOpen((v) => !v)}
            title={scoringOpen ? '채점 패널을 접고 자료를 넓게 봅니다' : '채점 패널을 다시 펼칩니다'}
            aria-pressed={!scoringOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM15 5v14" />
            </svg>
            {scoringOpen ? '채점 접기' : '채점 펼치기'}
          </button>
        </div>
      </div>

      {/* 본문: 좌우 분할 패널 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 패널 - 자료 뷰어 */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
          {/* 탭 바 */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-4 h-11">
            {LEFT_TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setLeftTab(i)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px h-full ${
                  leftTab === i
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {i === 0 && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {i === 1 && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
                {i === 2 && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {tab}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 overflow-auto bg-gray-100">
            {leftTab === 0 && (
              <div className="h-full flex flex-col">
                {files.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">제출된 파일이 없습니다.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 파일 인덱스 탭 */}
                    <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
                      {files.map((att, i) => {
                        const activeFile = i === activePdfIndex;
                        return (
                          <button
                            key={att.id}
                            onClick={() => setPdfIndex(i)}
                            title={att.originalFilename}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                              activeFile
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'text-gray-500 hover:bg-gray-100 border-transparent'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              activeFile ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {i + 1}
                            </span>
                            <span className="max-w-[380px] truncate">{att.originalFilename}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 선택한 파일 뷰어 */}
                    <Suspense fallback={(
                      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">뷰어를 불러오는 중…</div>
                    )}>
                      <PdfViewer
                        key={files[activePdfIndex].id}
                        url={files[activePdfIndex].contentUrl}
                        filename={files[activePdfIndex].originalFilename}
                        className="flex-1"
                      />
                    </Suspense>
                  </>
                )}
              </div>
            )}

            {leftTab === 1 && (
              <div className="p-6 space-y-4">
                {/* 지원 양식 답변 */}
                {answerFields.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">지원 양식</h3>
                    <div className="divide-y divide-gray-100">
                      {answerFields.map((field) => {
                        const answer = displayAnswer(field);
                        return (
                          <div key={field.fieldId} className="py-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                {FIELD_TYPE_LABEL[normalizeFieldType(field.fieldType)]}
                              </span>
                              <span className="text-sm font-medium text-gray-500">{field.label}</span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer || <span className="text-gray-300">미작성</span>}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                    작성된 지원 양식 답변이 없습니다.
                  </div>
                )}

                {view.attachments && view.attachments.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">제출 파일</h3>
                    <div className="space-y-2">
                      {view.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {att.originalFilename}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftTab === 2 && (
              <div className="p-6 space-y-4">
                {/* 지원 개요 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">지원 개요</h3>
                    {application && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {isTeamApp ? '팀 지원' : '개인 지원'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-400">프로그램</span>
                      <p className="text-sm text-gray-700 mt-0.5">{view.program.title}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">{isTeamApp ? '팀명' : '지원자'}</span>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{view.team.name}</p>
                    </div>
                    {view.team.description && (
                      <div>
                        <span className="text-xs text-gray-400">소개</span>
                        <p className="text-sm text-gray-700 mt-0.5">{view.team.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 팀 구성원 / 지원자 정보 */}
                {application ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{isTeamApp ? '팀 구성원' : '지원자 정보'}</h3>
                    {isTeamApp ? (
                      <TeamMemberList
                        leaderName={appInfo.name}
                        leaderEmail={appInfo.email}
                        members={appInfo.members}
                        phone={appInfo.phone}
                      />
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">이름</div>
                          <div className="text-sm text-gray-800 break-all">{appInfo.name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">이메일</div>
                          <div className="text-sm text-gray-800 break-all">{appInfo.email || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">연락처</div>
                          <div className="text-sm text-gray-800 break-all">{formatPhone(appInfo.phone) || '—'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      팀원 {view.team.members?.length ? `${view.team.members.length}명` : ''}
                    </h3>
                    {view.team.members && view.team.members.length > 0 ? (
                      <div className="space-y-3">
                        {view.team.members.map((member, i) => (
                          <div key={member.id || i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                              {(member.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700">{member.email}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">팀원 정보가 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 패널 - 채점 (접으면 왼쪽 자료 뷰어가 그만큼 넓어진다) */}
        {scoringOpen && (
        <div className="w-96 flex-shrink-0 flex flex-col bg-white overflow-hidden">
          {/* 채점 헤더 */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">
                채점 진행 <span className="font-semibold text-gray-800">{scoredCount} / {criteria.length}</span> 항목
              </span>
              <span className="text-sm text-gray-400">총점</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-full bg-gray-100 rounded-full h-1.5 mr-4">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: criteria.length > 0 ? `${(scoredCount / criteria.length) * 100}%` : '0%' }}
                />
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-2xl font-bold text-blue-600">{totalScore}</span>
                <span className="text-sm text-gray-400">/{maxTotal}</span>
              </div>
            </div>

            {/* 저장 상태 표시 (드라이브 스타일 자동저장 아이콘) */}
            <div className="mt-1.5 h-4 flex items-center justify-end gap-1 text-xs">
              {isReadOnly ? null : saving ? (
                <span className="flex items-center gap-1 text-gray-400">
                  <svg className="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  저장 중…
                </span>
              ) : dirty ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                  </svg>
                  저장되지 않은 변경사항
                </span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1 text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  임시저장됨 · {lastSavedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </div>
          </div>

          {/* 채점 항목 */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {criteria.map((criterion) => {
              const currentScore = scores[criterion.id];
              const hasScore = currentScore !== undefined && currentScore !== '';
              const scoreNum = hasScore ? Number(currentScore) : null;

              return (
                <div
                  key={criterion.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    hasScore ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {hasScore ? (
                          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="w-3.5 h-3.5 flex-shrink-0 text-xs font-bold text-gray-400 flex items-center justify-center">D</span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">{criterion.name}</span>
                      </div>
                      {criterion.description && (
                        <p className="text-xs text-gray-500 leading-relaxed">{criterion.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <span className="text-base font-bold text-gray-800">
                        {hasScore ? scoreNum : '—'}
                      </span>
                      <span className="text-xs text-gray-400">/{criterion.maxScore}</span>
                    </div>
                  </div>

                  {/* 점수 입력: 슬라이더 드래그 또는 직접 입력 */}
                  <ScoreInput
                    value={scoreNum}
                    maxScore={criterion.maxScore || 10}
                    onChange={(v) => handleScoreChange(criterion.id, v)}
                    disabled={isReadOnly}
                  />
                </div>
              );
            })}

            {/* 한줄평 */}
            <div className="rounded-xl border border-gray-200 p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">한줄평 (선택)</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isReadOnly}
                maxLength={200}
                placeholder="평가 대상에 대한 코멘트"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-default"
              />
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white">
            {message && (
              <div className={`px-4 py-2 text-xs text-center ${
                message.includes('실패') || message.includes('오류')
                  ? 'text-red-600 bg-red-50'
                  : 'text-green-600 bg-green-50'
              }`}>
                {message}
              </div>
            )}

            {isSubmittedReadOnly ? (
              <div className="px-4 py-2 text-xs text-center text-green-600 bg-green-50">
                {nextTeam ? '제출 완료 · 수정하거나 다음 팀으로 이동할 수 있습니다.' : '제출 완료 · 모든 팀 평가를 마쳤습니다.'}
              </div>
            ) : beforeStart ? (
              <div className="px-4 py-2 text-xs text-center text-gray-500 bg-gray-50">
                {evaluationStart}부터 채점할 수 있습니다. 자료는 미리 확인할 수 있습니다.
              </div>
            ) : isEditingSubmitted ? (
              <div className="px-4 py-2 text-xs text-center text-blue-600 bg-blue-50">
                제출된 평가 수정 중 · 수정 완료 시 즉시 반영됩니다.
              </div>
            ) : (
              !allScored && criteria.length > 0 && (
                <div className="px-4 py-2 text-xs text-center text-gray-400 bg-gray-50">
                  모든 항목 평가 시 제출할 수 있습니다.
                </div>
              )
            )}

            {isSubmittedReadOnly ? (
              <div className="flex gap-2 p-3">
                <button
                  onClick={() => { setIsEditingSubmitted(true); setMessage(''); }}
                  className="flex-1 py-2.5 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  수정하기
                </button>
                {nextTeam ? (
                  <button
                    onClick={() => navigateToTeam(nextTeam)}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    다음 팀
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={goToTeamList}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    완료
                  </button>
                )}
              </div>
            ) : beforeStart ? (
              <div className="flex gap-2 p-3">
                <button
                  onClick={goToTeamList}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  팀 목록으로
                </button>
                {nextTeam && (
                  <button
                    onClick={() => navigateToTeam(nextTeam)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    다음 팀
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            ) : isEditingSubmitted ? (
              <div className="flex gap-2 p-3">
                <button
                  onClick={handleCancelSubmittedEdit}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  수정 취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !allScored || !dirty}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? '수정 중...' : '수정 완료'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 p-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {saving ? '저장 중...' : '임시저장'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !allScored}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 ${
                    allScored
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {submitting ? '제출 중...' : allScored ? '최종 제출' : `${criteria.length - scoredCount}개 항목 남음`}
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 저장되지 않은 변경사항 확인창 */}
      {leaveAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={cancelLeave}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-800 mb-2">저장되지 않은 변경사항이 있습니다</h2>
            <p className="text-sm text-gray-500 mb-6">저장하지 않고 나가면 지금까지 입력한 점수와 한줄평이 사라집니다.</p>
            <div className="flex gap-3">
              <button
                onClick={cancelLeave}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                계속 작성
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
              >
                저장하지 않고 나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreInput({ value, maxScore, onChange, disabled = false }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  const sliderValue = hasValue ? Number(value) : 0;

  const handleText = (e) => {
    const raw = e.target.value;
    if (raw === '') { onChange(''); return; }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    onChange(Math.max(0, Math.min(maxScore, n)));
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-400 flex-shrink-0 w-3 text-center">0</span>
      <input
        type="range"
        min={0}
        max={maxScore}
        step={1}
        value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 h-1.5 accent-blue-600 cursor-pointer disabled:cursor-default disabled:opacity-60"
        aria-label="점수 슬라이더"
      />
      <span className="text-[10px] text-gray-400 flex-shrink-0 w-4 text-center">{maxScore}</span>
      <input
        type="number"
        min={0}
        max={maxScore}
        step={1}
        value={hasValue ? sliderValue : ''}
        onChange={handleText}
        disabled={disabled}
        placeholder="—"
        className="w-14 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-default"
        aria-label="점수 직접 입력"
      />
    </div>
  );
}
