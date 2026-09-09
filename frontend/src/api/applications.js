import api from './client';

// 지원자 회원가입 (role=MEMBER 고정)
export const signup = (data) => api.post('/signup', data);

// 프로그램 지원 시작(초안 생성). 이미 지원서가 있으면 기존 지원서를 반환한다.
export const startApplication = (programId, data) =>
  api.post(`/programs/${programId}/applications`, data);

// 지원서 단건 조회 (양식 항목 + 답변 + 첨부파일)
export const getApplication = (applicationId) => api.get(`/applications/${applicationId}`);

// 내 지원서 목록 (최근 수정순)
export const getMyApplications = () => api.get('/applications/me');

// 임시저장/수정
export const saveDraft = (applicationId, data) =>
  api.put(`/applications/${applicationId}/draft`, data);

// 최종 제출
export const submitApplication = (applicationId, data) =>
  api.put(`/applications/${applicationId}/submit`, data);

// 팀/본인 정보만 수정 (제출 상태 유지, 지원서에 즉시 반영)
export const updateTeamInfo = (applicationId, data) =>
  api.put(`/applications/${applicationId}/team-info`, data);

// 지원 취소
export const cancelApplication = (applicationId) => api.delete(`/applications/${applicationId}`);
