import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadPdfResponse } from '../src/utils/pdfDownload.js';

test('downloads server PDF bytes with the UTF-8 filename and cleans up the link', async (t) => {
  const previous = Object.fromEntries(['document', 'setTimeout'].map((key) => [key, globalThis[key]]));
  const events = [];
  const blob = new Blob(['%PDF-1.7\nserver-generated-document'], { type: 'application/pdf' });
  const link = { click() { events.push(this.download); }, remove() { events.push('removed'); } };
  globalThis.document = { createElement: () => link, body: { appendChild() {} } };
  globalThis.setTimeout = (callback) => callback();
  t.mock.method(URL, 'createObjectURL', (value) => { assert.equal(value, blob); return 'blob:pdf'; });
  t.mock.method(URL, 'revokeObjectURL', (url) => events.push(url));
  t.after(() => Object.assign(globalThis, previous));
  await downloadPdfResponse({ data: blob, headers: { 'content-disposition': "attachment; filename*=UTF-8''%ED%95%9C%EA%B8%80.pdf" } });
  assert.deepEqual(events, ['한글.pdf', 'removed', 'blob:pdf']);
});

test('rejects HTML and JSON error responses instead of saving a corrupted PDF', async () => {
  for (const value of ['<html>error</html>', '{"error":"unauthorized"}', '']) {
    await assert.rejects(downloadPdfResponse({ data: new Blob([value]), headers: {} }), /올바른 PDF/);
  }
});
