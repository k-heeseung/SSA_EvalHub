// 지원 양식 항목의 질문 유형 정의. 프론트/백엔드가 같은 문자열 값을 공유한다.
// 매니저가 선택할 수 있는 유형: 주관식 / 객관식 / 체크박스

export const FIELD_TYPES = [
  { value: 'TEXT', label: '주관식' },
  { value: 'RADIO', label: '객관식' },
  { value: 'CHECKBOX', label: '체크박스' },
];

export const FIELD_TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));

// 선택지를 매니저가 직접 입력하는 유형 (객관식/체크박스)
const OPTION_TYPES = new Set(['RADIO', 'CHECKBOX']);

// 예전 데이터나 비표준 값(주관식/장문형/드롭다운/파일 등)을 현재 유형으로 정규화한다.
export function normalizeFieldType(raw) {
  if (!raw) return 'TEXT';
  const v = String(raw).trim();
  const t = v.toLowerCase();
  if (t.includes('file') || t.includes('pdf') || t.includes('attachment') || t.includes('첨부') || v.includes('파일')) return 'FILE';
  if (v.includes('체크') || t === 'checkbox') return 'CHECKBOX';
  if (v.includes('객관') || t === 'radio' || t.includes('dropdown') || v.includes('드롭')) return 'RADIO';
  return 'TEXT'; // 주관식·단답형·장문형·날짜·시간 등 나머지
}

export function isOptionType(type) {
  return OPTION_TYPES.has(normalizeFieldType(type));
}

export function isFileType(type) {
  return normalizeFieldType(type) === 'FILE';
}

// 체크박스(복수 선택) 답변은 JSON 배열 문자열로 저장한다. 파싱/직렬화 헬퍼.
export function parseCheckboxValue(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifyCheckboxValue(list) {
  return list.length === 0 ? '' : JSON.stringify(list);
}
