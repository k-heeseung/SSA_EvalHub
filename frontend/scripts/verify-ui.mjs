import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Exercise rendered form semantics through the same JSX transform as the app.
// SSR covers initial markup; browser event and focus behavior need browser checks.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const render = (component, props, ...children) => renderToStaticMarkup(h(component, props, ...children));
const inputs = (html) => html.match(/<input\b[^>]*>/g) || [];
const noop = () => {};

try {
  const { Button, Input, TextArea, Select } = await server.ssrLoadModule('/src/components/ui.jsx');
  const { default: FieldInput } = await server.ssrLoadModule('/src/components/FieldInput.jsx');
  const { default: PageHeader } = await server.ssrLoadModule('/src/components/PageHeader.jsx');
  const { default: AdminBreadcrumbContext } = await server.ssrLoadModule('/src/contexts/AdminBreadcrumbContext.js');

  check('Button defaults to a non-submitting form control', () => {
    assert.match(render(Button, {}, '취소'), /<button\b[^>]*type="button"/);
  });
  check('Button preserves submit, disabled, ARIA, name and value', () => {
    const html = render(Button, { type: 'submit', disabled: true, 'aria-label': '지원서 제출', 'aria-busy': true, name: 'intent', value: 'submit' }, '제출');
    for (const attribute of ['type="submit"', 'disabled=""', 'aria-label="지원서 제출"', 'aria-busy="true"', 'name="intent"', 'value="submit"']) assert.ok(html.includes(attribute), attribute);
  });
  check('Input preserves controlled value, accessible label and disabled state', () => {
    const html = render(Input, { value: '가 < 나 & 다', onChange: noop, 'aria-label': '팀명', disabled: true, name: 'team' });
    assert.match(html, /value="가 &lt; 나 &amp; 다"/);
    assert.match(html, /aria-label="팀명"/);
    assert.match(html, /disabled=""/);
    assert.match(html, /name="team"/);
  });
  check('TextArea preserves controlled text and form accessibility props', () => {
    const html = render(TextArea, { value: '첫 줄\n<둘째 줄>', onChange: noop, 'aria-label': '소개', disabled: true, rows: 6 });
    assert.match(html, /aria-label="소개"/);
    assert.match(html, /disabled=""/);
    assert.match(html, /rows="6"/);
    assert.ok(html.includes('첫 줄\n&lt;둘째 줄&gt;</textarea>'));
  });
  check('Select retains controlled selection and native form attributes', () => {
    const html = render(Select, { value: 'b', onChange: noop, name: 'program', required: true, 'aria-label': '프로그램' }, h('option', { value: 'a' }, 'A'), h('option', { value: 'b' }, 'B'));
    assert.match(html, /name="program"/);
    assert.match(html, /required=""/);
    assert.match(html, /aria-label="프로그램"/);
    assert.match(html, /<option value="b" selected="">B<\/option>/);
  });
  check('FieldInput text fields retain values, labels and disabled state', () => {
    for (const fieldType of ['SHORT_TEXT', 'LONG_TEXT']) {
      const html = render(FieldInput, { field: { fieldId: 1, fieldType, label: '지원 동기' }, value: '답변 <내용>', onChange: noop, disabled: true });
      assert.match(html, /aria-label="지원 동기"/);
      assert.match(html, /disabled=""/);
      assert.ok(html.includes('답변 &lt;내용&gt;'));
    }
  });
  check('Repeated radio groups use distinct field names and correct checked state', () => {
    const html = [41, 42].map((fieldId) => render(FieldInput, { field: { fieldId, fieldType: 'RADIO', options: ['선택 A', '선택 B'] }, value: '선택 B', onChange: noop, disabled: true })).join('');
    const controls = inputs(html);
    assert.equal(controls.length, 4);
    for (const [index, name] of ['field-41', 'field-41', 'field-42', 'field-42'].entries()) {
      assert.ok(controls[index].includes(`name="${name}"`));
      assert.equal(controls[index].includes('checked=""'), index % 2 === 1);
      assert.ok(controls[index].includes('disabled=""'));
    }
    assert.equal((html.match(/<label\b/g) || []).length, 4);
  });
  check('Checkbox choices preserve multi-selection and label association', () => {
    const html = render(FieldInput, { field: { fieldId: 43, fieldType: 'CHECKBOX', options: ['A', 'B', 'C'] }, value: '["A","C"]', onChange: noop, disabled: true });
    const controls = inputs(html);
    assert.equal(controls.length, 3);
    assert.deepEqual(controls.map((tag) => tag.includes('checked=""')), [true, false, true]);
    assert.ok(controls.every((tag) => tag.includes('disabled=""')));
    assert.equal((html.match(/<label\b/g) || []).length, 3);
  });
  check('PageHeader renders escaped content, breadcrumb controls and child actions', () => {
    const html = render(PageHeader, { title: '<프로그램> & 결과', subtitle: '안내 <script>alert(1)</script>', breadcrumb: [{ label: '프로그램', onClick: noop }, '상세'] }, h(Button, { type: 'submit', 'aria-label': '변경 저장' }, '저장'));
    assert.match(html, /<h1\b[^>]*>&lt;프로그램&gt; &amp; 결과<\/h1>/);
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.match(html, /<button\b[^>]*>프로그램<\/button>/);
    assert.match(html, /<button\b[^>]*type="submit"[^>]*aria-label="변경 저장"[^>]*>저장<\/button>/);
  });
  check('Manager relocation removes only the breadcrumb and retains the entire page panel', () => {
    const html = render(AdminBreadcrumbContext.Provider, { value: null }, h(PageHeader, {
      title: '프로그램', subtitle: '프로그램 설명', breadcrumb: ['평가ON', '프로그램'],
    }, h(Button, {}, '프로그램 개설')));
    assert.match(html, /ui-card ui-page-header/);
    assert.match(html, /<h1[^>]*>프로그램<\/h1>/);
    assert.match(html, /프로그램 설명/);
    assert.match(html, /프로그램 개설/);
    assert.doesNotMatch(html, /ui-breadcrumb|평가ON/);
  });
  console.log(`\n${checks} shared UI semantic checks passed (SSR only).`);
} finally {
  await server.close();
}
