import api from './client';

export const getEvaluators = () => api.get('/evaluators');
export const createEvaluator = (data) => api.post('/evaluators', data);
export const getAssignmentsByEvaluator = (evaluatorId) => api.get(`/evaluators/${evaluatorId}/assignments`);
