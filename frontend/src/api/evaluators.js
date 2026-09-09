import api from './client';

export const getEvaluators = () => api.get('/evaluators');
export const createEvaluator = (data) => api.post('/users', { ...data, role: 'EVALUATOR' });
export const deleteEvaluator = (userId) => api.delete(`/users/${userId}`);
export const getAssignmentsByEvaluator = (evaluatorId) => api.get(`/evaluators/${evaluatorId}/assignments`);
