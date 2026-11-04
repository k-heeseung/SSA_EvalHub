import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSelectionError, uploadFilesSequentially, uploadResultMessage } from '../src/utils/attachmentUploads.js';

test('selection must fit remaining capacity; excess selection is rejected as a whole', () => {
  assert.equal(uploadSelectionError(1, 2, 3), '');
  assert.match(uploadSelectionError(2, 2, 3), /1개 더.*2개를 선택하여 업로드하지 않았습니다/);
  assert.match(uploadSelectionError(1, 4, 3), /0개 더/);
});

test('uploads are sequential, continue after a failure, and refresh once at the end', async () => {
  const files = ['a.pdf', 'b.pdf', 'c.pdf'].map((name) => ({ name }));
  const events = [];
  let active = 0;
  const result = await uploadFilesSequentially(files, async (file) => {
    assert.equal(active++, 0);
    events.push(file.name);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (file.name === 'b.pdf') throw { response: { data: { message: '최대 개수 초과' } } };
  }, async () => { events.push('refresh'); });
  assert.deepEqual(events, ['a.pdf', 'b.pdf', 'c.pdf', 'refresh']);
  assert.deepEqual(result.succeeded, ['a.pdf', 'c.pdf']);
  assert.deepEqual(result.failed, [{ name: 'b.pdf', reason: '최대 개수 초과' }]);
  const message = uploadResultMessage(result);
  assert.match(message, /성공 2개 · 실패 1개/);
  assert.match(message, /성공: a.pdf/);
  assert.match(message, /실패: b.pdf — 최대 개수 초과/);
});

test('all failed files are reported and still trigger a refresh', async () => {
  let refreshed = false;
  const result = await uploadFilesSequentially([{ name: 'bad.pdf' }], async () => {
    throw new Error('network');
  }, async () => { refreshed = true; });
  assert.equal(refreshed, true);
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed[0].reason, '업로드에 실패했습니다.');
});

test('successful uploads are preserved when refreshing the list throws', async () => {
  const result = await uploadFilesSequentially([{ name: 'ok.pdf' }], async () => {}, async () => {
    throw new Error('refresh');
  });
  assert.deepEqual(result.succeeded, ['ok.pdf']);
  assert.equal(result.failed.length, 0);
  assert.equal(result.refreshFailed, true);
  assert.match(uploadResultMessage(result), /화면을 새로고침/);
});

test('React Query refetch errors are shown separately from upload failures', async () => {
  const result = await uploadFilesSequentially([{ name: 'ok.pdf' }], async () => {},
    async () => ({ isError: true }));
  assert.equal(result.refreshFailed, true);
  assert.deepEqual(result.succeeded, ['ok.pdf']);
});
