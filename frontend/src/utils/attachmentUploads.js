import { isApplicationPeriodError, isApplicationDeadlineError } from './applicationPeriod.js';

export function uploadSelectionError(selectedCount, currentCount, maxCount) {
  const remaining = Math.max(0, maxCount - currentCount);
  return selectedCount > remaining
    ? `파일은 ${remaining}개 더 추가할 수 있습니다. ${selectedCount}개를 선택하여 업로드하지 않았습니다.`
    : '';
}

// 파일별 실패가 다음 파일의 업로드를 중단하지 않도록 순서대로 처리한다.
export async function uploadFilesSequentially(files, uploadOne, refresh) {
  const succeeded = [];
  const failed = [];
  for (const file of files) {
    try {
      await uploadOne(file);
      succeeded.push(file.name);
    } catch (error) {
      failed.push({ name: file.name, reason: error?.response?.data?.message || '업로드에 실패했습니다.' });
    }
  }
  let refreshFailed;
  try {
    const result = await refresh();
    refreshFailed = !!result?.isError;
  } catch {
    refreshFailed = true;
  }
  return { succeeded, failed, refreshFailed };
}

// Admit the selected batch once; there are no per-file period checks.
export async function uploadFilesTogether(files, uploadBatch, refresh) {
  let succeeded = [];
  let failed;
  let periodRejected = false;
  let deadlineRejected = false;
  try {
    const response = await uploadBatch(files);
    succeeded = response.data.uploaded.map((file) => file.originalFilename);
    failed = response.data.failed;
  } catch (error) {
    periodRejected = isApplicationPeriodError(error);
    deadlineRejected = isApplicationDeadlineError(error);
    const reason = error?.response?.data?.message || '업로드에 실패했습니다.';
    failed = files.map((file) => ({ name: file.name, reason }));
  }
  let refreshFailed;
  try { refreshFailed = !!(await refresh())?.isError; } catch { refreshFailed = true; }
  return { succeeded, failed, refreshFailed,
    ...(periodRejected ? { periodRejected } : {}), ...(deadlineRejected ? { deadlineRejected } : {}) };
}

export function uploadResultMessage({ succeeded, failed, refreshFailed }) {
  return [
    `업로드 성공 ${succeeded.length}개 · 실패 ${failed.length}개`,
    ...succeeded.map((name) => `성공: ${name}`),
    ...failed.map(({ name, reason }) => `실패: ${name} — ${reason}`),
    ...(refreshFailed ? ['첨부 목록을 새로 불러오지 못했습니다. 업로드 결과를 확인하려면 화면을 새로고침해주세요.'] : []),
  ].join('\n');
}
