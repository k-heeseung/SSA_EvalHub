import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPrograms, getTeams, getTeamApplication, getEvaluationResults, updateTeamBonus,
} from '../api/programs';
import { getTeamAttachments } from '../api/attachments';
import { FIELD_TYPE_LABEL, normalizeFieldType, isFileType, parseCheckboxValue } from '../utils/formFields';
import { teamAverage } from '../utils/export';
import { bonusSummary, validBonusScore } from '../utils/bonus';
import TeamMemberList from '../components/TeamMemberList';
import { formatPhone } from '../utils/phone';
import { queryKeys } from '../query/keys';
import { useApiQuery, useLiveApiQuery } from '../query/useApiQuery';

// pdfjs 번들이 크므로 뷰어를 열 때만 로드한다.
const PdfViewer = lazy(() => import('../components/PdfViewer'));

const LEFT_TABS = ['발표 자료', '지원서 정보', '팀 정보'];

function displayAnswer(field) {
  if (normalizeFieldType(field.fieldType) === 'CHECKBOX') {
    return parseCheckboxValue(field.value).join(', ');
  }
  return field.value || '';
}

const fmt = (n) => (n == null ? '—' : Number(n).toFixed(1));

export default function TeamBonusPage() {
  const { programId, teamId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [leftTab, setLeftTab] = useState(0);
  const [pdfIndex, setPdfIndex] = useState(0);
  const [bonusInputs, setBonusInputs] = useState({});
  const [savedBonusInputs, setSavedBonusInputs] = useState({});
  const [message, setMessage] = useState('');
  const hydratedRef = useRef(null);

  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const program = (programsQuery.data ?? []).find((p) => p.id === Number(programId));
  const teamsQuery = useLiveApiQuery(queryKeys.teams(programId), () => getTeams(programId));
  const teams = teamsQuery.data ?? [];
  const attachmentsQuery = useLiveApiQuery(queryKeys.teamAttachments(teamId), () => getTeamAttachments(teamId));
  const applicationQuery = useApiQuery(queryKeys.teamApplication(teamId), () => getTeamApplication(teamId), { retry: false });
  const resultsQuery = useLiveApiQuery(queryKeys.evaluationResults(programId), () => getEvaluationResults(programId));

  const currentTeam = teams.find((t) => t.teamId === Number(teamId));
  const currentIndex = teams.findIndex((t) => t.teamId === Number(teamId));
  const prevTeam = currentIndex > 0 ? teams[currentIndex - 1] : null;
  const nextTeam = currentIndex >= 0 && currentIndex < teams.length - 1 ? teams[currentIndex + 1] : null;

  const application = applicationQuery.data ?? null;
  const appInfo = application?.applicantInfo || currentTeam?.applicantInfo || {};
  const isTeamApp = (application?.participantType ?? currentTeam?.participantType) === 'TEAM';
  const answerFields = (application?.fields || []).filter((f) => !isFileType(f.fieldType));
  const files = attachmentsQuery.data ?? [];
  const activePdfIndex = Math.min(pdfIndex, Math.max(0, files.length - 1));

  const result = (resultsQuery.data ?? []).find((r) => r.teamId === Number(teamId));
  const base = result ? teamAverage(result) : null;

  const items = program?.bonusItems ?? [];
  const dirty = items.some((item) => (bonusInputs[item.id] ?? '') !== (savedBonusInputs[item.id] ?? ''));
  useEffect(() => {
    if (!currentTeam) return;
    const signature = `${teamId}:${JSON.stringify(currentTeam.bonusScores)}`;
    if (hydratedRef.current?.signature === signature) return;
    if (hydratedRef.current?.teamId === teamId && dirty) return;
    hydratedRef.current = { teamId, signature };
    const inputs = Object.fromEntries((currentTeam.bonusScores ?? []).map((item) =>
      [item.itemId, item.score == null ? '' : String(Number(item.score))]));
    setBonusInputs(inputs);
    setSavedBonusInputs(inputs);
    setPdfIndex(0);
    setMessage('');
  }, [currentTeam, teamId, dirty]);
  const values = items.map((item) => ({ itemId: item.id,
    score: (bonusInputs[item.id] ?? '') === '' ? null : Number(bonusInputs[item.id]) }));
  const summary = bonusSummary(values);
  const bonusNum = summary.total;
  const bonusValid = items.length > 0 && items.every((item) => validBonusScore(bonusInputs[item.id] ?? '', item.maxScore));
  const total = base != null ? base + (bonusNum ?? 0) : bonusNum;

  const saveMutation = useMutation({
    mutationFn: () => updateTeamBonus(programId, teamId, {
      scores: values,
    }),
  });
  const saving = saveMutation.isPending;

  const handleSave = async () => {
    if (!bonusValid) {
      setMessage('각 항목의 점수를 0 이상, 최대 점수 이하, 소수 둘째 자리까지 입력하세요.');
      return false;
    }
    setMessage('');
    try {
      const res = await saveMutation.mutateAsync();
      const inputs = Object.fromEntries((res.data.bonusScores ?? []).map((item) =>
        [item.itemId, item.score == null ? '' : String(Number(item.score))]));
      setBonusInputs(inputs);
      setSavedBonusInputs(inputs);
      hydratedRef.current = { teamId, signature: `${teamId}:${JSON.stringify(res.data.bonusScores)}` };
      queryClient.setQueryData(queryKeys.teams(programId), (cur) =>
        (cur ?? []).map((t) => (t.teamId === Number(teamId) ? res.data : t)));
      queryClient.invalidateQueries({ queryKey: queryKeys.evaluationResults(programId) });
      setMessage('가산점이 저장되었습니다.');
      return true;
    } catch (err) {
      setMessage(err.response?.data?.message || '저장에 실패했습니다.');
      return false;
    }
  };

  const confirmDiscardIfDirty = () =>
    !dirty || window.confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠어요?');

  const goToTeam = (team) => {
    if (saving || !confirmDiscardIfDirty()) return;
    navigate(`/admin/programs/${programId}/bonus/${team.teamId}`);
  };
  const goToProgram = () => { if (!saving) navigate(`/admin/programs/${programId}`); };

  const saveAndAdvance = async () => {
    const ok = await handleSave();
    if (!ok) return;
    if (nextTeam) navigate(`/admin/programs/${programId}/bonus/${nextTeam.teamId}`);
    else goToProgram();
  };

  // 가산점이 비활성화된 프로그램은 접근 불가.
  if (programsQuery.data && program && !program.bonusEnabled) {
    return <Navigate to={`/admin/programs/${programId}`} replace />;
  }
  if (teamsQuery.isPending || programsQuery.isPending) {
    return <div className="h-full flex items-center justify-center text-gray-400">로딩 중...</div>;
  }
  if (!currentTeam) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">팀을 찾을 수 없습니다.</p>
        <button onClick={goToProgram} className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">프로그램으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 상단 네비게이션 바 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center h-12 px-4 gap-3">
        <button
          onClick={() => { if (confirmDiscardIfDirty()) goToProgram(); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          프로그램
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800">#{String(currentIndex + 1).padStart(2, '0')} {currentTeam.name}</span>
          <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">가산점 입력</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {teams.length > 1 && (
            <span className="text-sm text-gray-400">{currentIndex + 1} / {teams.length} 팀</span>
          )}
          {prevTeam && (
            <button
              onClick={() => goToTeam(prevTeam)}
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
              onClick={() => goToTeam(nextTeam)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              다음
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 본문: 좌우 분할 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 - 자료 뷰어 */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
          <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-4 h-11">
            {LEFT_TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setLeftTab(i)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px h-full ${
                  leftTab === i
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto bg-gray-100">
            {leftTab === 0 && (
              <div className="h-full flex flex-col">
                {files.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-500">제출된 파일이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
                      {files.map((att, i) => {
                        const activeFile = i === activePdfIndex;
                        return (
                          <button
                            key={att.id}
                            onClick={() => setPdfIndex(i)}
                            title={att.originalFilename}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                              activeFile ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 hover:bg-gray-100 border-transparent'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              activeFile ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>{i + 1}</span>
                            <span className="max-w-[380px] truncate">{att.originalFilename}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-gray-400">뷰어를 불러오는 중…</div>}>
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
              <div className="p-6">
                {answerFields.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">제출 받을 항목</h3>
                    <div className="divide-y divide-gray-100">
                      {answerFields.map((field) => (
                        <div key={field.fieldId} className="py-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                              {FIELD_TYPE_LABEL[normalizeFieldType(field.fieldType)]}
                            </span>
                            <span className="text-sm font-medium text-gray-500">{field.label}</span>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {displayAnswer(field) || <span className="text-gray-300">미작성</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                    작성된 제출 받을 항목 답변이 없습니다.
                  </div>
                )}
              </div>
            )}

            {leftTab === 2 && (
              <div className="p-6 space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">지원 개요</h3>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      {isTeamApp ? '팀 지원' : '개인 지원'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-400">{isTeamApp ? '팀명' : '지원자'}</span>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{currentTeam.name}</p>
                    </div>
                    {currentTeam.description && (
                      <div>
                        <span className="text-xs text-gray-400">소개</span>
                        <p className="text-sm text-gray-700 mt-0.5">{currentTeam.description}</p>
                      </div>
                    )}
                  </div>
                </div>

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
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 - 가산점 입력 */}
        <div className="w-[380px] flex-shrink-0 flex flex-col bg-white">
          <div className="flex-1 overflow-auto p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">가산점 입력</h2>
              <p className="text-xs text-gray-400 mt-0.5">매니저 단독 평가 · 심사위원 평균에 가산됩니다.</p>
            </div>

            {/* 점수 요약 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-[11px] text-gray-400 mb-1">심사위원 평균</p>
                <p className="text-lg font-bold text-gray-700">{fmt(base)}</p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
                <p className="text-[11px] text-purple-500 mb-1">가산점</p>
                <p className="text-lg font-bold text-purple-700">{bonusNum != null ? bonusNum : '—'}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-[11px] text-blue-500 mb-1">총합</p>
                <p className="text-lg font-bold text-blue-700">{fmt(total)}</p>
              </div>
            </div>

            <p className="text-xs text-purple-600">{summary.completed}/{summary.count}개 입력{summary.completed === summary.count ? ' · 입력 완료' : ''}</p>
            {items.map((item) => {
              const value = bonusInputs[item.id] ?? '';
              const valid = validBonusScore(value, item.maxScore);
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  <label htmlFor={`bonus-${item.id}`} className="block text-sm font-medium text-gray-700 break-words">{item.name}</label>
                  <p className="text-xs text-gray-400 mt-1 mb-2">{item.maxScore == null ? '상한 없음' : `최대 ${Number(item.maxScore)}점`}</p>
                  <div className="flex items-center gap-2">
                    <input id={`bonus-${item.id}`} type="number" min="0" max={item.maxScore ?? 99999999.99} step="0.01"
                      value={value} placeholder="—" disabled={saving}
                      onChange={(e) => setBonusInputs((inputs) => ({ ...inputs, [item.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <button type="button" disabled={saving || value === ''} onClick={() => setBonusInputs((inputs) => ({ ...inputs, [item.id]: '' }))}
                      className="shrink-0 text-xs text-gray-500 disabled:opacity-40">초기화</button>
                  </div>
                  {!valid && <p className="text-xs text-red-600 mt-2">0 이상, 최대 점수 이하로 소수 둘째 자리까지 입력하세요.</p>}
                </div>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div className="flex-shrink-0 border-t border-gray-100">
            {message && (
              <div className={`px-4 py-2 text-xs text-center ${
                message.includes('실패') || message.includes('세요')
                  ? 'text-red-600 bg-red-50'
                  : 'text-green-600 bg-green-50'
              }`}>
                {message}
              </div>
            )}
            <div className="flex gap-2 p-3">
              <button
                onClick={handleSave}
                disabled={saving || !dirty || !bonusValid}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={saveAndAdvance}
                disabled={saving || !bonusValid}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
              >
                {nextTeam ? '저장 후 다음 팀' : '저장 후 완료'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
