import api from './client';

export const getEvaluators = () => api.get('/evaluators');
export const createEvaluator = (data) => api.post('/evaluators', data);
export const getInvitations = () => api.get('/evaluator-invitations');
export const getInvitation = (id) => api.get(`/evaluators/${id}/invitation`);
export const retryInvitation = (id) => api.post(`/evaluators/${id}/invitation/retry`);
export const deleteEvaluator = (userId) => api.delete(`/users/${userId}`);
export const getAssignmentsByEvaluator = (evaluatorId) => api.get(`/evaluators/${evaluatorId}/assignments`);
