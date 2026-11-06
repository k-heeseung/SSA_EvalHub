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

// One HTTP request gives every selected file the same server receipt time.
export const uploadAttachmentBatch = (teamId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/teams/${teamId}/attachments/batch`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
