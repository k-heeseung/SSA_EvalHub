import api from './client';

export const getPrograms = () => api.get('/programs');
export const createProgram = (data) => api.post('/programs', data);
export const getTeams = (programId) => api.get(`/programs/${programId}/teams`);
export const createTeam = (programId, data) => api.post(`/programs/${programId}/teams`, data);
export const getCriteria = (programId) => api.get(`/programs/${programId}/criteria`);
export const createCriterion = (programId, data) => api.post(`/programs/${programId}/criteria`, data);
export const createAssignment = (programId, data) => api.post(`/programs/${programId}/assignments`, data);
