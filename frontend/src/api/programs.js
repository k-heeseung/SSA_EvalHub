import api from './client';

export const getPrograms = () => api.get('/programs');
export const getOpenPrograms = () => api.get('/programs/open');
// Program period requests accept *At offset datetimes; responses include schedule.
// Existing date-only payloads remain supported during the frontend transition.
export const createProgram = (data) => api.post('/programs', data);
export const updateProgram = (programId, data) => api.patch(`/programs/${programId}`, data);
export const changeStatus = (programId, data) => api.patch(`/programs/${programId}/status`, data);
export const deleteProgram = (programId) => api.delete(`/programs/${programId}`);

export const getTeams = (programId) => api.get(`/programs/${programId}/teams`);
export const getTeam = (programId, teamId) => api.get(`/programs/${programId}/teams/${teamId}`);
export const getTeamApplication = (teamId) => api.get(`/teams/${teamId}/application`);
export const updateTeamApplication = (teamId, data) => api.put(`/teams/${teamId}/application`, data);
export const updateTeam = (programId, teamId, data) => api.put(`/programs/${programId}/teams/${teamId}`, data);
export const deleteTeam = (programId, teamId) => api.delete(`/programs/${programId}/teams/${teamId}`);
export const changeTeamStatus = (programId, teamId, data) => api.patch(`/programs/${programId}/teams/${teamId}/status`, data);
export const updateTeamBonus = (programId, teamId, data) => api.patch(`/programs/${programId}/teams/${teamId}/bonus`, data);

export const getTeamMembers = (teamId) => api.get(`/teams/${teamId}/members`);
export const addTeamMember = (teamId, data) => api.post(`/teams/${teamId}/members`, data);
export const removeTeamMember = (teamId, memberId) => api.delete(`/teams/${teamId}/members/${memberId}`);
export const lookupUser = (email) => api.get('/users/lookup', { params: { email } });

export const getFormFields = (programId) => api.get(`/programs/${programId}/form-fields`);
export const replaceFormFields = (programId, data) => api.put(`/programs/${programId}/form-fields`, data);

export const getCriteria = (programId) => api.get(`/programs/${programId}/criteria`);
export const createCriterion = (programId, data) => api.post(`/programs/${programId}/criteria`, data);
export const updateCriterion = (programId, criterionId, data) => api.put(`/programs/${programId}/criteria/${criterionId}`, data);
export const deleteCriterion = (programId, criterionId) => api.delete(`/programs/${programId}/criteria/${criterionId}`);

export const getAssignmentsByProgram = (programId) => api.get(`/programs/${programId}/assignments`);
export const getEvaluatorsByProgram = (programId) => api.get(`/programs/${programId}/evaluators`);
export const createAssignment = (programId, data) => api.post(`/programs/${programId}/assignments`, data);
export const cancelAssignment = (assignmentId) => api.delete(`/assignments/${assignmentId}`);

export const getEvaluationResults = (programId) => api.get(`/programs/${programId}/evaluation-results`);
export const getEvaluationResultsPdf = (programId, onlyPassed = false) =>
  api.get(`/programs/${programId}/evaluation-results/pdf`, { params: { onlyPassed }, responseType: 'blob' });
