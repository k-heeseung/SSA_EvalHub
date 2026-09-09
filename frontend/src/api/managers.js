import api from './client';

// 매니저 계정 관리 (최고 관리자 전용). 계정 생성/삭제는 공용 /users 엔드포인트를 사용한다.
export const getManagers = () => api.get('/managers');
export const createManager = (data) => api.post('/users', { ...data, role: 'MANAGER' });
export const deleteManager = (userId) => api.delete(`/users/${userId}`);
