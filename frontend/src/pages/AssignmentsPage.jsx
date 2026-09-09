import { useState, useMemo } from 'react';
import { useMutation, useQueries } from '@tanstack/react-query';
import { getPrograms, getAssignmentsByProgram, createAssignment, cancelAssignment } from '../api/programs';
import { getEvaluators } from '../api/evaluators';
import PageHeader from '../components/PageHeader';
import { queryKeys } from '../query/keys';
import { LIVE_REFETCH_INTERVAL, useLiveApiQuery } from '../query/useApiQuery';

const EVALUATOR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];

const PROGRAM_COLORS = [
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-purple-500', text: 'text-white' },
  { bg: 'bg-green-500', text: 'text-white' },
  { bg: 'bg-red-500', text: 'text-white' },
  { bg: 'bg-teal-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
];

const STATUS_BADGE = {
  ACTIVE:     { label: '평가 진행',  cls: 'bg-green-100 text-green-700' },
  RECRUITING: { label: '지원 접수',  cls: 'bg-blue-100 text-blue-700' },
  SCHEDULED:  { label: '접수 예정',  cls: 'bg-violet-100 text-violet-700' },
  INACTIVE:   { label: '집계 완료',  cls: 'bg-gray-100 text-gray-500' },
  DRAFT:      { label: '임시 저장',  cls: 'bg-gray-100 text-gray-400' },
};

const TYPE_LABEL = {
  MODULE_A: '프로그램 지원/심사 시스템',
  MODULE_B: '팀/프로젝트 평가',
};

function getEvaluatorColor(email = '') {
  return EVALUATOR_COLORS[email.charCodeAt(0) % EVALUATOR_COLORS.length];
}

function getInitials(name = '', email = '') {
  if (name) return name.charAt(0).toUpperCase();
  return email.charAt(0).toUpperCase();
}

function getProgramColor(index) {
  return PROGRAM_COLORS[index % PROGRAM_COLORS.length];
}

// 신규 배정 제안: 미배정 슬롯을 채움, 부담이 적은 심사위원 우선
function computeSmartSuggestions(programs, evaluators, effectiveMap) {
  if (!evaluators.length || !programs.length) return [];

  const workload = Object.fromEntries(evaluators.map((ev) => [ev.id, 0]));
  programs.forEach((p) => {
    Object.keys(effectiveMap[p.id] ?? {}).forEach((evId) => {
      if (workload[evId] !== undefined) workload[evId]++;
    });
  });

  const target = evaluators.length <= 2 ? evaluators.length : Math.ceil(evaluators.length / 2);
  const suggestions = [];

  [...programs]
    .sort((a, b) =>
      Object.keys(effectiveMap[a.id] ?? {}).length -
      Object.keys(effectiveMap[b.id] ?? {}).length
    )
    .forEach((program) => {
      const assigned = new Set(Object.keys(effectiveMap[program.id] ?? {}).map(Number));
      const needed = target - assigned.size;
      if (needed <= 0) return;

      evaluators
        .filter((ev) => !assigned.has(ev.id))
        .sort((a, b) => workload[a.id] - workload[b.id])
        .slice(0, needed)
        .forEach((ev) => {
          suggestions.push({ programId: program.id, evaluatorId: ev.id, action: 'add' });
          workload[ev.id]++;
        });
    });

  return suggestions;
}

// 재배정 제안: 불균등 판정 임계값 = 최대-최소 차이 >= 2
function computeRebalanceSuggestions(programs, evaluators, effectiveMap) {
  if (evaluators.length < 2 || !programs.length) return [];

  const workload = Object.fromEntries(evaluators.map((ev) => [ev.id, 0]));
  programs.forEach((p) => {
    Object.entries(effectiveMap[p.id] ?? {}).forEach(([evId, a]) => {
      if (a.status !== 'SUBMITTED' && workload[evId] !== undefined) workload[evId]++;
    });
  });

  const counts = Object.values(workload);
  if (Math.max(...counts) - Math.min(...counts) < 2) return [];

  const total = counts.reduce((s, c) => s + c, 0);
  const avgFloor = Math.floor(total / evaluators.length);
  const avgCeil  = Math.ceil(total / evaluators.length);
  void avgFloor;

  const suggestions = [];
  const sim = { ...workload };
  const simAssigned = {};
  programs.forEach((p) => {
    simAssigned[p.id] = new Set(
      Object.entries(effectiveMap[p.id] ?? {})
        .filter(([, a]) => a.status !== 'SUBMITTED')
        .map(([evId]) => Number(evId))
    );
  });

  let changed = true;
  while (changed) {
    changed = false;
    const overEv = evaluators
      .filter((ev) => sim[ev.id] > avgCeil)
      .sort((a, b) => sim[b.id] - sim[a.id])[0];
    if (!overEv) break;

    for (const program of programs) {
      if (!simAssigned[program.id].has(overEv.id)) continue;

      const underEv = evaluators
        .filter((ev) => ev.id !== overEv.id && !simAssigned[program.id].has(ev.id) && sim[ev.id] < avgCeil)
        .sort((a, b) => sim[a.id] - sim[b.id])[0];
      if (!underEv) continue;

      suggestions.push({ programId: program.id, evaluatorId: overEv.id,  action: 'remove' });
      suggestions.push({ programId: program.id, evaluatorId: underEv.id, action: 'add'    });
      simAssigned[program.id].delete(overEv.id);
      simAssigned[program.id].add(underEv.id);
      sim[overEv.id]--;
      sim[underEv.id]++;
      changed = true;
      break;
    }
  }

  return suggestions;
}

// pendingAction: undefined(확정) | 'add'(대기 추가) | 'remove'(대기 해제)
function AssignCell({ checked, submitted, pendingAction, onChange }) {
  const isPendingAdd    = pendingAction === 'add';
  const isPendingRemove = pendingAction === 'remove';

  let cls = 'inline-flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all duration-150 ';
  if (submitted) {
    cls += checked ? 'bg-gray-300 border-gray-300 cursor-not-allowed' : 'border-gray-200 bg-gray-50 cursor-not-allowed';
  } else if (isPendingAdd) {
    cls += 'bg-amber-400 border-amber-400 hover:bg-amber-500 hover:border-amber-500 cursor-pointer';
  } else if (isPendingRemove) {
    cls += 'bg-white border-red-400 hover:border-red-500 cursor-pointer';
  } else if (checked) {
    cls += 'bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700 cursor-pointer';
  } else {
    cls += 'border-gray-300 bg-white hover:border-blue-400 cursor-pointer';
  }

  return (
    <button
      type="button"
      onClick={onChange}
      disabled={submitted}
      title={submitted ? '제출 완료된 배정은 취소할 수 없습니다.' : undefined}
      className={cls}
    >
      {isPendingRemove ? (
        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (checked || isPendingAdd) ? (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
    </button>
  );
}

export default function AssignmentsPage() {
  // 로컬 대기 변경: { [programId]: { [evaluatorId]: 'add' | 'remove' } }
  const [pendingMap, setPendingMap] = useState({});
  const activeTab = 'all';
  const [smartModal, setSmartModal] = useState(null);
  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());
  const evaluatorsQuery = useLiveApiQuery(queryKeys.evaluators, () => getEvaluators());
  const programs = (programsQuery.data ?? []).filter((program) => program.status !== 'DRAFT');
  const evaluators = evaluatorsQuery.data ?? [];
  const assignmentQueries = useQueries({
    queries: programs.map((program) => ({
      queryKey: queryKeys.programAssignments(program.id),
      queryFn: async () => (await getAssignmentsByProgram(program.id)).data,
      staleTime: 15_000,
      refetchInterval: LIVE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    })),
  });
  const assignmentMap = useMemo(() => {
    const map = {};
    programs.forEach((program, index) => {
      map[program.id] = {};
      (assignmentQueries[index]?.data ?? []).forEach((assignment) => {
        if (assignment.evaluatorId != null) {
          map[program.id][assignment.evaluatorId] = {
            id: assignment.id,
            status: assignment.status,
          };
        }
      });
    });
    return map;
  }, [programs, assignmentQueries]);
  const loading = programsQuery.isPending || evaluatorsQuery.isPending
    || assignmentQueries.some((query) => query.isPending);

  // pendingMap + assignmentMap를 합산한 화면 표시용 맵
  const effectiveMap = useMemo(() => {
    const result = {};
    programs.forEach((p) => {
      result[p.id] = { ...(assignmentMap[p.id] ?? {}) };
      Object.entries(pendingMap[p.id] ?? {}).forEach(([evId, action]) => {
        if (action === 'add') {
          result[p.id][evId] = { id: null, status: 'PENDING' };
        } else {
          delete result[p.id][evId];
        }
      });
    });
    return result;
  }, [programs, assignmentMap, pendingMap]);

  // 체크박스 클릭 → pendingMap만 업데이트 (API 호출 없음)
  const toggleAssignment = (programId, evaluatorId) => {
    const serverAssignment = assignmentMap[programId]?.[evaluatorId];
    if (serverAssignment?.status === 'SUBMITTED') return;

    setPendingMap((prev) => {
      const programPending = { ...(prev[programId] ?? {}) };
      const currentPending = programPending[evaluatorId];

      if (currentPending) {
        // 이미 대기 중인 변경을 취소(토글)
        delete programPending[evaluatorId];
      } else if (serverAssignment) {
        // 서버에 존재 → 해제 대기
        programPending[evaluatorId] = 'remove';
      } else {
        // 서버에 없음 → 추가 대기
        programPending[evaluatorId] = 'add';
      }

      return { ...prev, [programId]: programPending };
    });
  };

  const pendingCount = Object.values(pendingMap).reduce(
    (sum, p) => sum + Object.keys(p).length, 0
  );
  const hasPendingChanges = pendingCount > 0;
  const applyMutation = useMutation({
    mutationFn: async () => {
      for (const [programIdStr, changes] of Object.entries(pendingMap)) {
        const programId = Number(programIdStr);
        for (const [evaluatorIdStr, action] of Object.entries(changes)) {
          const evaluatorId = Number(evaluatorIdStr);
          if (action === 'remove') {
            const assignment = assignmentMap[programId]?.[evaluatorId];
            if (assignment) await cancelAssignment(assignment.id);
          } else {
            await createAssignment(programId, { evaluatorId });
          }
        }
      }
    },
  });
  const applying = applyMutation.isPending;

  // 배정 확정: pendingMap을 일괄 API 적용
  const confirmAssignments = async () => {
    if (!hasPendingChanges) return;
    try {
      await applyMutation.mutateAsync();
      setPendingMap({});
    } catch {
      alert('배정 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      // pending state is managed by the mutation.
    }
  };

  // 취소: 모든 대기 변경 폐기
  const cancelChanges = () => {
    setPendingMap({});
  };

  const openSmartModal = () => {
    const addSuggestions       = computeSmartSuggestions(programs, evaluators, effectiveMap);
    const rebalanceSuggestions = computeRebalanceSuggestions(programs, evaluators, effectiveMap);
    setSmartModal([...addSuggestions, ...rebalanceSuggestions]);
  };

  // 스마트 배정 적용 → pendingMap에 반영 (API는 확정 시점에 호출)
  const applySmartSuggestions = (suggestions) => {
    setSmartModal(null);
    setPendingMap((prev) => {
      const next = { ...prev };
      suggestions.forEach(({ programId, evaluatorId, action }) => {
        next[programId] = { ...(next[programId] ?? {}) };
        const serverEntry = assignmentMap[programId]?.[evaluatorId];
        const currentPending = next[programId][evaluatorId];

        if (action === 'add') {
          if (!serverEntry && currentPending !== 'add') {
            next[programId][evaluatorId] = 'add';
          }
        } else {
          if (serverEntry && serverEntry.status !== 'SUBMITTED') {
            next[programId][evaluatorId] = 'remove';
          } else if (!serverEntry && currentPending === 'add') {
            delete next[programId][evaluatorId];
          }
        }
      });
      return next;
    });
  };

  const assignedPrograms   = programs.filter((p) => Object.keys(effectiveMap[p.id] ?? {}).length > 0);
  const unassignedPrograms = programs.filter((p) => Object.keys(effectiveMap[p.id] ?? {}).length === 0);
  const totalAssignments   = programs.reduce((sum, p) => sum + Object.keys(effectiveMap[p.id] ?? {}).length, 0);
  const avgPerProgram      = programs.length > 0 ? (totalAssignments / programs.length).toFixed(1) : '—';

  const evaluatorWorkload = evaluators.map((ev) => ({
    ...ev,
    count: programs.filter((p) => effectiveMap[p.id]?.[ev.id] !== undefined).length,
  }));
  const maxWorkload = Math.max(...evaluatorWorkload.map((e) => e.count), 1);

  const displayedPrograms = activeTab === 'unassigned' ? unassignedPrograms : programs;

  return (
    <div className="p-8">
      <PageHeader
        breadcrumb={['EvalHub', '심사 배정']}
        title="심사위원 배정"
        subtitle="심사위원을 프로그램 단위로 배정합니다. 배정된 심사위원은 해당 프로그램의 모든 지원 팀을 평가합니다."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={cancelChanges}
            disabled={!hasPendingChanges}
            className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              hasPendingChanges
                ? 'border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer'
                : 'border-gray-200 text-gray-300 cursor-not-allowed'
            }`}
          >
            취소
          </button>
          <button
            onClick={confirmAssignments}
            disabled={!hasPendingChanges || applying}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasPendingChanges && !applying
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {applying ? '처리 중...' : hasPendingChanges ? `배정 확정 (${pendingCount}건)` : '배정 확정'}
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="text-center py-20 text-gray-400">로딩 중...</div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* 매트릭스 */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
              {evaluators.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">등록된 심사위원이 없습니다.</div>
              ) : displayedPrograms.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">표시할 프로그램이 없습니다.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 min-w-[200px]">프로그램</th>
                      {evaluators.map((ev) => (
                        <th key={ev.id} className="px-3 py-3 text-center min-w-[60px]">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full ${getEvaluatorColor(ev.email)} flex items-center justify-center text-white text-xs font-semibold`}>
                              {getInitials(ev.name, ev.email)}
                            </div>
                            <span className="text-xs text-gray-500 max-w-[56px] truncate leading-tight">
                              {ev.name || ev.email?.split('@')[0]}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 min-w-[48px]">합계</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayedPrograms.map((program, idx) => {
                      const rowMap       = effectiveMap[program.id] ?? {};
                      const assignedCount = Object.keys(rowMap).length;
                      const color        = getProgramColor(idx);
                      const badge        = STATUS_BADGE[program.status] ?? STATUS_BADGE.DRAFT;
                      const typeLabel    = TYPE_LABEL[program.type] ?? program.type;
                      return (
                        <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                                {program.title.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-semibold text-gray-900">{program.title}</span>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {typeLabel} · {program.teamCount ?? 0}팀
                                </div>
                              </div>
                            </div>
                          </td>
                          {evaluators.map((ev) => {
                            const assignment   = rowMap[ev.id];
                            const pendingAction = pendingMap[program.id]?.[ev.id];
                            return (
                              <td key={ev.id} className="px-3 py-3.5 text-center">
                                <div className="flex justify-center">
                                  <AssignCell
                                    checked={!!assignment}
                                    submitted={assignment?.status === 'SUBMITTED'}
                                    pendingAction={pendingAction}
                                    onChange={() => toggleAssignment(program.id, ev.id)}
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`text-sm font-semibold ${assignedCount > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                              {assignedCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 우측 사이드바 */}
          <div className="w-52 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">배정 현황</h3>
              <div className="space-y-2.5">
                <SidebarStat label="총 프로그램"      value={programs.length} />
                <SidebarStat label="배정 완료"        value={assignedPrograms.length}   valueColor="text-blue-600" />
                <SidebarStat label="프로그램별 평균"  value={avgPerProgram} />
                <SidebarStat label="미배정 프로그램"  value={unassignedPrograms.length} valueColor="text-amber-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">심사위원별 부담</h3>
              {evaluatorWorkload.length === 0 ? (
                <p className="text-xs text-gray-400">없음</p>
              ) : (
                <div className="space-y-2.5">
                  {evaluatorWorkload.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-14 truncate flex-shrink-0">
                        {ev.name || ev.email?.split('@')[0]}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${(ev.count / maxWorkload) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{ev.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold text-blue-700">스마트 배정</span>
              </div>
              <p className="text-xs text-blue-600 mb-3 leading-relaxed">
                전문 분야·부담 균등화를 고려해 자동으로 프로그램을 배정합니다.
              </p>
              <button
                onClick={openSmartModal}
                className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer"
              >
                제안 받기
              </button>
            </div>
          </div>
        </div>
      )}

      {smartModal !== null && (
        <SmartAssignModal
          suggestions={smartModal}
          programs={programs}
          evaluators={evaluators}
          onApply={(filtered) => applySmartSuggestions(filtered)}
          onClose={() => setSmartModal(null)}
        />
      )}
    </div>
  );
}

function SmartAssignModal({ suggestions, programs, evaluators, onApply, onClose }) {
  const [pending, setPending] = useState(suggestions);

  const removeItem = (programId, evaluatorId, action) => {
    setPending((prev) => prev.filter(
      (s) => !(s.programId === programId && s.evaluatorId === evaluatorId && s.action === action)
    ));
  };

  const programMap   = Object.fromEntries(programs.map((p) => [p.id, p]));
  const evaluatorMap = Object.fromEntries(evaluators.map((e) => [e.id, e]));

  const addCount    = pending.filter((s) => s.action === 'add').length;
  const removeCount = pending.filter((s) => s.action === 'remove').length;

  const grouped = pending.reduce((acc, { programId, evaluatorId, action }) => {
    acc[programId] ??= { add: [], remove: [] };
    acc[programId][action].push(evaluatorId);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-base font-semibold text-gray-800">스마트 배정 제안</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5">
          {pending.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {suggestions.length === 0 ? '모든 프로그램에 배정이 완료되었습니다.' : '모든 제안을 제거했습니다.'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {suggestions.length === 0 ? '추가로 제안할 배정이 없습니다.' : '적용할 배정이 없습니다.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                {addCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <span className="w-4 h-4 bg-blue-100 rounded-full inline-flex items-center justify-center text-[10px]">+</span>
                    추가 {addCount}건
                  </span>
                )}
                {removeCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                    <span className="w-4 h-4 bg-red-100 rounded-full inline-flex items-center justify-center text-[10px]">−</span>
                    해제 {removeCount}건
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">× 로 제외 가능</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Object.entries(grouped).map(([programId, { add, remove }]) => {
                  const program = programMap[programId];
                  return (
                    <div key={programId} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-gray-700 mb-1.5">{program?.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {remove.map((evId) => {
                          const ev = evaluatorMap[evId];
                          return (
                            <span key={`r-${evId}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-red-50 text-red-600 text-xs rounded-full border border-red-100">
                              <span className="text-[10px] font-bold">−</span>
                              {ev?.name || ev?.email?.split('@')[0] || evId}
                              <button
                                type="button"
                                onClick={() => removeItem(Number(programId), evId, 'remove')}
                                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-200 text-red-300 hover:text-red-600 transition-colors cursor-pointer ml-0.5"
                              >×</button>
                            </span>
                          );
                        })}
                        {add.map((evId) => {
                          const ev = evaluatorMap[evId];
                          return (
                            <span key={`a-${evId}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {ev?.name || ev?.email?.split('@')[0] || evId}
                              <button
                                type="button"
                                onClick={() => removeItem(Number(programId), evId, 'add')}
                                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-200 text-blue-400 hover:text-blue-700 transition-colors cursor-pointer ml-0.5"
                              >×</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
          >
            취소
          </button>
          {pending.length > 0 && (
            <button
              onClick={() => onApply(pending)}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              적용하기 ({pending.length}건)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarStat({ label, value, valueColor = 'text-gray-900' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}
