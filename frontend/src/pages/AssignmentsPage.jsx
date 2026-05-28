import { useState, useEffect } from 'react';
import { getPrograms, getTeams, createAssignment } from '../api/programs';
import { getEvaluators, getAssignmentsByEvaluator } from '../api/evaluators';

export default function AssignmentsPage() {
  const [programs, setPrograms] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState({}); // { "participantId-evaluatorId": true }
  const [loading, setLoading] = useState(true);

  // 프로그램, 심사위원 목록 로드
  useEffect(() => {
    Promise.all([getPrograms(), getEvaluators()])
      .then(([programsRes, evaluatorsRes]) => {
        setPrograms(programsRes.data);
        setEvaluators(evaluatorsRes.data);
        if (programsRes.data.length > 0) {
          setSelectedProgram(programsRes.data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 선택된 프로그램의 팀 + 배정 현황 로드
  useEffect(() => {
    if (!selectedProgram || evaluators.length === 0) return;

    const loadData = async () => {
      try {
        const teamsRes = await getTeams(selectedProgram.id);
        setTeams(teamsRes.data);

        // 각 심사위원의 배정 목록을 가져와서 매트릭스 구성
        const assignmentMap = {};
        for (const evaluator of evaluators) {
          const res = await getAssignmentsByEvaluator(evaluator.id);
          for (const a of res.data) {
            if (a.programId === selectedProgram.id) {
              assignmentMap[`${a.participantId}-${evaluator.id}`] = a;
            }
          }
        }
        setAssignments(assignmentMap);
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, [selectedProgram, evaluators]);

  const handleAssign = async (participantId, evaluatorId) => {
    const key = `${participantId}-${evaluatorId}`;
    if (assignments[key]) return; // 이미 배정됨

    try {
      await createAssignment(selectedProgram.id, { participantId, evaluatorId });
      // 배정 현황 새로고침
      const res = await getAssignmentsByEvaluator(evaluatorId);
      const newMap = { ...assignments };
      for (const a of res.data) {
        if (a.programId === selectedProgram.id) {
          newMap[`${a.participantId}-${evaluatorId}`] = a;
        }
      }
      setAssignments(newMap);
    } catch (err) {
      const msg = err.response?.data?.message || '배정에 실패했습니다.';
      alert(msg);
    }
  };

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">심사 배정</h1>

      {/* 프로그램 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">평가 사업 선택</label>
        <select
          value={selectedProgram?.id || ''}
          onChange={(e) => {
            const p = programs.find((p) => p.id === Number(e.target.value));
            setSelectedProgram(p);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* 배정 매트릭스 */}
      {teams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">등록된 팀이 없습니다. 먼저 팀을 등록해주세요.</p>
        </div>
      ) : evaluators.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">등록된 심사위원이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 min-w-[180px]">
                  평가 대상
                </th>
                {evaluators.map((e) => (
                  <th
                    key={e.id}
                    className="text-center px-4 py-3 text-sm font-medium text-gray-500 min-w-[120px]"
                  >
                    <div className="truncate">{e.email.split('@')[0]}</div>
                    <div className="text-xs text-gray-400 font-normal">ID: {e.id}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.teamId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{team.name}</td>
                  {evaluators.map((evaluator) => {
                    const key = `${team.participantId}-${evaluator.id}`;
                    const assignment = assignments[key];
                    const isAssigned = !!assignment;

                    return (
                      <td key={evaluator.id} className="text-center px-4 py-4">
                        {isAssigned ? (
                          <div className="flex flex-col items-center">
                            <span className="text-green-600 text-lg">&#10003;</span>
                            <span className="text-xs text-gray-400 mt-1">
                              {assignment.status === 'SUBMITTED'
                                ? '제출완료'
                                : assignment.status === 'IN_PROGRESS'
                                ? '진행중'
                                : '배정됨'}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAssign(team.participantId, evaluator.id)}
                            className="w-8 h-8 border-2 border-dashed border-gray-300 rounded text-gray-300 hover:border-indigo-400 hover:text-indigo-400 transition-colors cursor-pointer text-lg leading-none"
                            title={`${team.name}에 ${evaluator.email} 배정`}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
