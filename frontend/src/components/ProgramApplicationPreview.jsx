import { useRef, useState } from 'react';
import FieldInput from './FieldInput';

export default function ProgramApplicationPreview({ title, participantType, fields, attachmentsEnabled, maxAttachments }) {
  const dialog = useRef(null);
  const [answers, setAnswers] = useState({});
  return <>
    <button type="button" className="ui-button program-editor-preview-button" onClick={() => dialog.current.showModal()}>지원자 화면 미리보기</button>
    <dialog ref={dialog} className="program-editor-preview" aria-labelledby="program-preview-title">
      <h2 id="program-preview-title">{title.trim() || '프로그램'} 지원서</h2>
      <p className="program-editor-help">입력 내용을 확인하는 미리보기이며 실제 지원서는 저장되지 않습니다.</p>
      <div className="program-editor-preview-fields">
        {(participantType === 'TEAM' ? ['지원자 이름', '연락처', '이메일', '팀 이름', '팀원 정보'] : ['지원자 이름', '연락처', '이메일']).map((name) => <label key={name}>{name}<input className="ui-input" placeholder={`${name} 입력`} /></label>)}
        {fields.map((field, index) => <div key={field.id}><div className="program-editor-input-label">{field.label || `항목 ${index + 1}`}{field.required && <span className="program-editor-required">필수</span>}</div>
          <FieldInput field={{ fieldId: `preview-${field.id}`, label: field.label || `항목 ${index + 1}`, fieldType: field.type, options: (field.options || []).filter((option) => option.trim()) }} value={answers[field.id] || ''} onChange={(value) => setAnswers((previous) => ({ ...previous, [field.id]: value }))} />
        </div>)}
        {attachmentsEnabled && <p className="program-editor-help">PDF 첨부 · 최대 {Number(maxAttachments) || 1}개 (미리보기에서는 업로드하지 않습니다.)</p>}
      </div>
      <button type="button" className="ui-button" onClick={() => dialog.current.close()}>닫기</button>
    </dialog>
  </>;
}
