import api from './client';

export const getEvaluationView = (assignmentId) => api.get(`/evaluation-assignments/${assignmentId}`);
export const saveDraft = (assignmentId, data) => api.put(`/evaluation-assignments/${assignmentId}/draft`, data);
export const submitEvaluation = (assignmentId, data) => api.post(`/evaluation-assignments/${assignmentId}/submit`, data);
