import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_TYPES, FIELD_TYPE_LABEL, normalizeFieldType, isOptionType, hasCheckboxSelection, parseCheckboxValue, stringifyCheckboxValue } from '../src/utils/formFields.js';

test('required checkboxes reject empty, malformed, and non-text selections', () => {
  for (const value of [null, undefined, '', ' ', '[]', '[""]', '["   "]', '[null]', '[1,true,{}]',
    'not-json', '{}', 'null', '"창업"', '["창업"] trailing']) {
    assert.equal(hasCheckboxSelection(value), false, String(value));
  }
});

test('one or more actual selections satisfy the required check', () => {
  assert.equal(hasCheckboxSelection('["창업"]'), true);
  assert.equal(hasCheckboxSelection('["창업","기술"]'), true);
});

test('checkbox labels survive the JSON answer format including special characters', () => {
  const selected = ['창업', '기술 "AI"', 'A\\B', '쉼표, 포함'];
  const answer = stringifyCheckboxValue(selected);
  assert.deepEqual(parseCheckboxValue(answer), selected);
  assert.equal(hasCheckboxSelection(answer), true);
});

test('deselecting the last choice returns the existing empty answer format', () => {
  assert.equal(stringifyCheckboxValue([]), '');
  assert.equal(hasCheckboxSelection(stringifyCheckboxValue([])), false);
});


test('manager offers short and long text instead of legacy subjective type', () => {
  assert.deepEqual(FIELD_TYPES.map(({ value }) => value), ['SHORT_TEXT', 'LONG_TEXT', 'RADIO', 'CHECKBOX']);
  assert.equal(FIELD_TYPE_LABEL.SHORT_TEXT, '단답형');
  assert.equal(FIELD_TYPE_LABEL.LONG_TEXT, '장문형');
});
test('short and long text remain distinct and legacy multiline answers stay multiline', () => {
  for (const value of ['SHORT_TEXT', 'short_text', '단답형']) assert.equal(normalizeFieldType(value), 'SHORT_TEXT');
  for (const value of ['LONG_TEXT', 'long_text', '장문형', 'TEXT', '주관식', null]) assert.equal(normalizeFieldType(value), 'LONG_TEXT');
  assert.equal(isOptionType('SHORT_TEXT'), false);
  assert.equal(isOptionType('LONG_TEXT'), false);
  assert.equal(normalizeFieldType('RADIO'), 'RADIO');
  assert.equal(normalizeFieldType('CHECKBOX'), 'CHECKBOX');
  assert.equal(normalizeFieldType('FILE'), 'FILE');
});
