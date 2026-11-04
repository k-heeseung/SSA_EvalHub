import api from './client';

export const getEvaluatorAssignments = () => api.get('/evaluation-assignments/me');
export const getAssignmentTeams = (assignmentId) =>
  api.get(`/evaluation-assignments/${assignmentId}/teams`);
export const getEvaluationView = (assignmentId, teamId) =>
  api.get(`/evaluation-assignments/${assignmentId}/teams/${teamId}`);
// data.scores에는 현재 입력된 점수를 전부 보낸다. 빠진 항목의 기존 점수는 삭제된다.
export const saveDraft = (assignmentId, teamId, data) =>
  api.put(`/evaluation-assignments/${assignmentId}/teams/${teamId}/draft`, data);
export const submitEvaluation = (assignmentId, teamId, data) =>
  api.post(`/evaluation-assignments/${assignmentId}/teams/${teamId}/submit`, data);
