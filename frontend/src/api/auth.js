import api from './client';

export const login = (data) => api.post('/auth/login', data);
export const getSessionUser = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');
export const changePassword = (data) => api.put('/auth/password', data);
