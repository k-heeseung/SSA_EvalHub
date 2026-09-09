import { normalizeFieldType, parseCheckboxValue, stringifyCheckboxValue } from '../utils/formFields';

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow';

// 질문 유형에 맞는 입력 UI를 렌더링한다. (주관식/객관식/체크박스)
// 지원자 지원 폼(ApplicantFormPage)과 매니저 지원정보 수정 창(TeamDetailPage)이 공유한다.
export default function FieldInput({ field, value, onChange, disabled = false }) {
  const type = normalizeFieldType(field.fieldType);
  const options = field.options || [];

  if (type === 'RADIO') {
    return (
      <div className="space-y-2.5">
        {options.map((opt, i) => (
          <label key={i} className={`flex items-center gap-2.5 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
            <input
              type="radio"
              name={`field-${field.fieldId}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
              disabled={disabled}
              className="accent-blue-600 cursor-pointer w-4 h-4 disabled:cursor-default"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  if (type === 'CHECKBOX') {
    const selected = parseCheckboxValue(value);
    const toggle = (opt) => {
      const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
      onChange(stringifyCheckboxValue(next));
    };
    return (
      <div className="space-y-2.5">
        {options.map((opt, i) => (
          <label key={i} className={`flex items-center gap-2.5 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              disabled={disabled}
              className="accent-blue-600 cursor-pointer w-4 h-4 rounded disabled:cursor-default"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  // TEXT (기본): 주관식
  return (
    <textarea
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${INPUT_CLASS} resize-y disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default`}
    />
  );
}
