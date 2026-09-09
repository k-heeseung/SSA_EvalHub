import api from './client';

export const getTeamAttachments = (teamId) => api.get(`/teams/${teamId}/attachments`);
export const uploadAttachment = (teamId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/teams/${teamId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteAttachment = (attachmentId) => api.delete(`/attachments/${attachmentId}`);
