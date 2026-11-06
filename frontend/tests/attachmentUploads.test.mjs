import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSelectionError, uploadFilesSequentially, uploadFilesTogether, uploadResultMessage } from '../src/utils/attachmentUploads.js';

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

test('selected files are sent in one batch and finish after the deadline without per-file checks', async () => {
  const files = [{ name: 'a.pdf' }, { name: 'b.pdf' }];
  let requests = 0;
  let refreshed = 0;
  const result = await uploadFilesTogether(files, async (selected) => {
    requests++;
    assert.equal(selected, files);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { data: { uploaded: selected.map((file) => ({ originalFilename: file.name })), failed: [] } };
  }, async () => { refreshed++; });
  assert.equal(requests, 1);
  assert.equal(refreshed, 1);
  assert.deepEqual(result.succeeded, ['a.pdf', 'b.pdf']);
  assert.deepEqual(result.failed, []);
});

test('batch preserves per-file success and failure results', async () => {
  const result = await uploadFilesTogether([{ name: 'a.pdf' }, { name: 'bad.txt' }], async () => ({ data: {
    uploaded: [{ originalFilename: 'a.pdf' }], failed: [{ name: 'bad.txt', reason: 'Only PDF' }],
  } }), async () => {});
  assert.deepEqual(result.succeeded, ['a.pdf']);
  assert.deepEqual(result.failed, [{ name: 'bad.txt', reason: 'Only PDF' }]);
  assert.equal(result.periodRejected, undefined);
});

test('late arrival rejected by the server marks the whole batch failed and refreshes', async () => {
  let refreshed = false;
  const result = await uploadFilesTogether([{ name: 'a.pdf' }, { name: 'b.pdf' }], async () => {
    throw { response: { data: { message: '지원 마감' } } };
  }, async () => { refreshed = true; });
  assert.equal(refreshed, true);
  assert.deepEqual(result.succeeded, []);
  assert.equal(result.failed.length, 2);
  assert.equal(result.failed[0].reason, '지원 마감');
  assert.equal(result.periodRejected, true);
  assert.equal(result.deadlineRejected, true);
});

test('batch successes survive a failed list refresh', async () => {
  const result = await uploadFilesTogether([{ name: 'a.pdf' }], async () => ({
    data: { uploaded: [{ originalFilename: 'a.pdf' }], failed: [] },
  }), async () => { throw new Error('network'); });
  assert.deepEqual(result.succeeded, ['a.pdf']);
  assert.equal(result.refreshFailed, true);
});
