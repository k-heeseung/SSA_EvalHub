import api from './client';

export const getEvaluatorAssignments = () => api.get('/evaluation-assignments/me');
export const getAssignmentTeams = (assignmentId) =>
  api.get(`/evaluation-assignments/${assignmentId}/teams`);
export const getEvaluationView = (assignmentId, teamId) =>
  api.get(`/evaluation-assignments/${assignmentId}/teams/${teamId}`);
export const saveDraft = (assignmentId, teamId, data) =>
  api.put(`/evaluation-assignments/${assignmentId}/teams/${teamId}/draft`, data);
export const submitEvaluation = (assignmentId, teamId, data) =>
  api.post(`/evaluation-assignments/${assignmentId}/teams/${teamId}/submit`, data);
