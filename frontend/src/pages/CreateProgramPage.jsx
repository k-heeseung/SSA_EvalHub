import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  createProgram, updateProgram, changeStatus, getPrograms, deleteProgram,
  getCriteria, createCriterion, updateCriterion, deleteCriterion,
  getFormFields, replaceFormFields,
} from '../api/programs';
import PageHeader from '../components/PageHeader';
import { FIELD_TYPES, normalizeFieldType, isOptionType } from '../utils/formFields';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

let criterionKeySeq = 0;
const newCriterion = () => ({ key: `c${Date.now()}_${criterionKeySeq++}`, id: null, name: '', description: '', weight: '1' });

const DragIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="8" cy="5" r="1.5" /><circle cx="16" cy="5" r="1.5" />
    <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
    <circle cx="8" cy="19" r="1.5" /><circle cx="16" cy="19" r="1.5" />
  </svg>
);

// 객관식/체크박스 선택지 앞에 붙는 마커
function OptionMarker({ type }) {
  if (normalizeFieldType(type) === 'CHECKBOX') {
    return <span className="w-4 h-4 flex-shrink-0 border-2 border-gray-300 rounded-sm" />;
  }
  return <span className="w-4 h-4 flex-shrink-0 border-2 border-gray-300 rounded-full" />;
}

function parseDateText(raw) {
  if (!raw.trim()) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  const m = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

function DateInput({ value, onChange, placeholder = 'YYYY-MM-DD' }) {
  const [text, setText] = useState(value || '');
  const pickerRef = useRef(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setText(value || ''); }, [value]);

  const handleChange = (e) => setText(e.target.value);

  const handleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); } };
  const handleBlur = () => handleConfirm();

  const handleConfirm = () => {
    const parsed = parseDateText(text);
    if (parsed === null) {
      setText(value || '');
    } else {
      setText(parsed);
      onChange(parsed);
    }
  };

  const handlePickerChange = (e) => {
    setText(e.target.value);
    onChange(e.target.value);
  };

  const openPicker = () => {
    try { pickerRef.current?.showPicker(); } catch { pickerRef.current?.click(); }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
        tabIndex={-1}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ''}
        onChange={handlePickerChange}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-lg">
      {type === 'success' ? (
        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      )}
      {message}
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function CreateProgramPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const isEditMode = !!programId;
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const programsQuery = useLiveApiQuery(queryKeys.programs, () => getPrograms());

  // 폼 상태
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('MODULE_A');
  const [participantType, setParticipantType] = useState('INDIVIDUAL');
  const [applicationStart, setApplicationStart] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [evaluationStart, setEvaluationStart] = useState('');
  const [evaluationDeadline, setEvaluationDeadline] = useState('');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [criteriaItems, setCriteriaItems] = useState([]);
  const [removedCriterionIds, setRemovedCriterionIds] = useState([]);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [maxAttachments, setMaxAttachments] = useState('1');
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [maxBonus, setMaxBonus] = useState('5');

  // 임시저장 상태
  const [draftId, setDraftId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftsBannerDismissed, setDraftsBannerDismissed] = useState(false);

  // UI 상태
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // 드래그 상태 (지원 양식 / 평가 항목 각각)
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const criterionDragIndex = useRef(null);
  const [criterionDragOverIndex, setCriterionDragOverIndex] = useState(null);
  const formContainerRef = useRef(null);

  // draft 이어서 작성
  const loadDraft = (draft) => {
    setDraftId(draft.id);
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    setType(draft.type || 'MODULE_A');
    setParticipantType(draft.participantType || 'INDIVIDUAL');
    setApplicationStart(draft.applicationStart || '');
    setApplicationDeadline(draft.applicationDeadline || '');
    setEvaluationStart(draft.evaluationStart || '');
    setEvaluationDeadline(draft.evaluationDeadline || '');
    setEligibilityCriteria(draft.eligibilityCriteria || '');
    setAttachmentsEnabled(!!draft.attachmentsEnabled);
    setMaxAttachments(draft.maxAttachments != null ? String(draft.maxAttachments) : '1');
    setBonusEnabled(!!draft.bonusEnabled);
    setMaxBonus(draft.maxBonus != null ? String(draft.maxBonus) : '5');
    setDraftsBannerDismissed(true);
  };

  // 기존 프로그램의 지원 양식 항목을 폼에 로드한다.
  const loadFormFields = (id) => {
    queryClient.fetchQuery({
      queryKey: queryKeys.formFields(id),
      queryFn: async () => (await getFormFields(id)).data,
    })
      .then((data) => {
        setFormItems(
          data.map((f) => ({
            id: f.id,
            label: f.label ?? '',
            required: !!f.required,
            type: normalizeFieldType(f.fieldType),
            options: Array.isArray(f.options) ? f.options : [],
          }))
        );
      })
      .catch(() => {});
  };

  // 기존 프로그램의 평가 항목을 폼에 로드한다.
  const loadCriteria = (id) => {
    queryClient.fetchQuery({
      queryKey: queryKeys.criteria(id),
      queryFn: async () => (await getCriteria(id)).data,
    })
      .then((data) => {
        setCriteriaItems(
          data.map((c) => ({
            key: `c${c.id}`,
            id: c.id,
            name: c.name ?? '',
            description: c.description ?? '',
            weight: c.weight != null ? String(Number(c.weight)) : '1',
          }))
        );
        setRemovedCriterionIds([]);
      })
      .catch(() => {});
  };

  // 페이지 진입 시 데이터 로드
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const all = programsQuery.data;
    if (!all || initializedRef.current) return;
    initializedRef.current = true;

    if (isEditMode) {
      const target = all.find((p) => p.id === Number(programId));
      if (target) { loadDraft(target); loadCriteria(target.id); loadFormFields(target.id); }
    } else {
      const draftPrograms = all.filter((p) => p.status === 'DRAFT');
      setDrafts(draftPrograms);
      const autoLoadId = location.state?.loadDraftId;
      if (autoLoadId) {
        const target = all.find((p) => p.id === autoLoadId);
        if (target) { loadDraft(target); loadCriteria(target.id); loadFormFields(target.id); }
      }
    }
    // Form hydration intentionally runs once so background refetches never overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programsQuery.data, isEditMode, programId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ message: msg, type });
  }, []);

  const formData = () => ({
    title,
    description,
    type,
    managerId: null,
    applicationStart: applicationStart || null,
    applicationDeadline: applicationDeadline || null,
    evaluationStart: evaluationStart || null,
    evaluationDeadline: evaluationDeadline || null,
    eligibilityCriteria: eligibilityCriteria || null,
    attachmentsEnabled,
    maxAttachments: attachmentsEnabled ? (Number(maxAttachments) || 1) : null,
    bonusEnabled,
    maxBonus: bonusEnabled ? (Number(maxBonus) || 0) : null,
    participantType,
  });

  const extractError = (err) =>
    err.response?.data?.message
    || err.response?.data?.error
    || err.message
    || '요청에 실패했습니다.';

  const validateDates = ({ required = false } = {}) => {
    if (required && !applicationStart) {
      showToast('지원 시작일을 입력해주세요.', 'error');
      return false;
    }
    if (required && !applicationDeadline) {
      showToast('지원 마감일을 입력해주세요.', 'error');
      return false;
    }
    if (required && !evaluationStart) {
      showToast('평가 시작일을 입력해주세요.', 'error');
      return false;
    }
    if (required && !evaluationDeadline) {
      showToast('평가 기한을 입력해주세요.', 'error');
      return false;
    }
    if (applicationStart && applicationDeadline && applicationStart > applicationDeadline) {
      showToast('지원 마감일은 지원 시작일보다 빠를 수 없습니다.', 'error');
      return false;
    }
    if (applicationDeadline && evaluationStart && evaluationStart < applicationDeadline) {
      showToast('평가 시작일은 지원 마감일보다 빠를 수 없습니다.', 'error');
      return false;
    }
    if (evaluationStart && evaluationDeadline && evaluationDeadline < evaluationStart) {
      showToast('평가 마감일은 평가 시작일보다 빠를 수 없습니다.', 'error');
      return false;
    }
    return true;
  };

  const handleAdvanceOnEnter = useCallback((e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (['checkbox', 'radio', 'file', 'hidden'].includes(target.type)) return;

    const fields = Array.from(formContainerRef.current?.querySelectorAll(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select'
    ) || []).filter((field) => (
      !field.disabled && !field.readOnly && field.tabIndex >= 0 && field.getClientRects().length > 0
    ));
    const next = fields[fields.indexOf(target) + 1];
    if (!next) return;

    e.preventDefault();
    next.focus();
    if (next instanceof HTMLInputElement && ['text', 'number'].includes(next.type)) next.select();
  }, []);

  // 임시저장된 프로그램(초안) 삭제
  const handleDeleteDraft = async (id) => {
    if (!window.confirm('이 임시저장 프로그램을 삭제하시겠습니까?')) return;
    try {
      await deleteProgram(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (draftId === id) setDraftId(null);
      showToast('임시저장을 삭제했습니다.');
    } catch (err) {
      showToast(`삭제 실패: ${extractError(err)}`, 'error');
    }
  };

  // 임시 저장
  const handleDraftSave = async () => {
    if (!title.trim()) { showToast('프로그램 명을 입력해주세요.', 'error'); return; }
    if (!validateDates()) return;
    if (hasIncompleteCriterion()) { showToast('평가 항목 이름을 입력해주세요.', 'error'); return; }
    setSaving(true);
    setError('');
    try {
      let pid;
      if (draftId) {
        await updateProgram(draftId, formData());
        pid = draftId;
      } else {
        const res = await createProgram({ ...formData(), status: 'DRAFT' });
        setDraftId(res.data.id);
        setDrafts((prev) => prev.filter((d) => d.id !== res.data.id).concat(res.data));
        pid = res.data.id;
      }
      await syncCriteria(pid);
      await syncFormFields(pid);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.criteria(pid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.formFields(pid) }),
      ]);
      loadCriteria(pid);   // 새로 생성된 항목의 id를 채워 재저장 시 중복 생성을 막는다.
      loadFormFields(pid); // 저장된 지원 양식 항목의 id로 갱신한다.
      showToast('임시 저장되었습니다.');
    } catch (err) {
      setError(`임시 저장 실패: ${extractError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // 이름 없이 다른 값만 입력된 평가 항목이 있는지 검증
  const hasIncompleteCriterion = () =>
    criteriaItems.some((c) => !c.name.trim() && (c.description.trim() || String(c.weight) !== '1'));

  // 수정 저장 (편집 모드)
  const handleEditSave = async () => {
    if (!title.trim())        { showToast('프로그램 명을 입력해주세요.', 'error'); return; }
    if (!validateDates({ required: true })) return;
    if (hasEmptyOptionField()) { showToast('선택지 유형 항목에 선택지를 최소 1개 입력해주세요.', 'error'); return; }
    if (hasIncompleteCriterion()) { showToast('평가 항목 이름을 입력해주세요.', 'error'); return; }
    setSaving(true);
    setError('');
    try {
      await updateProgram(Number(programId), formData());
      await syncCriteria(Number(programId));
      await syncFormFields(Number(programId));
      navigate(`/admin/programs/${programId}`);
    } catch (err) {
      setError(`저장 실패: ${extractError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // 개설 (ACTIVE로 전환)
  const handleCreate = async () => {
    if (!title.trim())          { showToast('프로그램 명을 입력해주세요.', 'error'); return; }
    if (!validateDates({ required: true })) return;
    if (formItems.length === 0) { showToast('지원 양식 항목을 최소 1개 추가해주세요.', 'error'); return; }
    if (hasEmptyOptionField()) { showToast('선택지 유형 항목에 선택지를 최소 1개 입력해주세요.', 'error'); return; }
    if (hasIncompleteCriterion()) { showToast('평가 항목 이름을 입력해주세요.', 'error'); return; }
    setSubmitting(true);
    setError('');
    try {
      let pid;
      if (draftId) {
        await updateProgram(draftId, formData());
        await changeStatus(draftId, { status: 'ACTIVE' });
        pid = draftId;
      } else {
        const res = await createProgram({ ...formData(), status: 'ACTIVE' });
        pid = res.data.id;
      }
      await syncCriteria(pid);
      await syncFormFields(pid);
      navigate('/admin/programs');
    } catch (err) {
      setError(`생성 실패: ${extractError(err)}`);
      setSubmitting(false);
    }
  };

  // 지원 양식
  const addFormItem = () => {
    setFormItems((prev) => [
      ...prev,
      { id: Date.now(), label: '', required: false, type: 'TEXT', options: [] },
    ]);
  };

  const updateFormItem = (id, field, value) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // 유형 변경. 선택지 유형으로 바꿀 때 선택지가 없으면 빈 항목 하나를 넣어 편집기를 노출한다.
  const changeFormItemType = (id, newType) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, type: newType };
        if (isOptionType(newType) && (!item.options || item.options.length === 0)) {
          next.options = [''];
        }
        return next;
      })
    );
  };

  const addOption = (id) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, options: [...(item.options || []), ''] } : item))
    );
  };

  const updateOption = (id, index, value) => {
    setFormItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, options: item.options.map((o, i) => (i === index ? value : o)) }
          : item
      )
    );
  };

  const removeOption = (id, index) => {
    setFormItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, options: item.options.filter((_, i) => i !== index) } : item
      )
    );
  };

  const removeFormItem = (id) => {
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 선택지 유형인데 유효한 선택지가 하나도 없는 항목이 있는지 검증
  const hasEmptyOptionField = () =>
    formItems.some(
      (item) =>
        item.label.trim() &&
        isOptionType(item.type) &&
        (item.options || []).filter((o) => o.trim()).length === 0
    );

  // 평가 항목
  const addCriterion = () => {
    setCriteriaItems((prev) => [...prev, newCriterion()]);
  };

  const updateCriterionItem = (key, field, value) => {
    setCriteriaItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const removeCriterion = (key) => {
    setCriteriaItems((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target?.id) setRemovedCriterionIds((ids) => [...ids, target.id]);
      return prev.filter((item) => item.key !== key);
    });
  };

  // 로컬 평가 항목을 백엔드에 반영한다. (삭제 → 수정/생성, displayOrder는 화면 순서)
  const syncCriteria = async (pid) => {
    await Promise.all(removedCriterionIds.map((cid) => deleteCriterion(pid, cid).catch(() => {})));
    await Promise.all(
      criteriaItems
        .filter((item) => item.name.trim())
        .map((item, index) => {
          const payload = {
            name: item.name.trim(),
            description: item.description.trim() || null,
            weight: Number(item.weight) || 1,
            displayOrder: index + 1,
          };
          return item.id
            ? updateCriterion(pid, item.id, payload)
            : createCriterion(pid, payload);
        })
    );
  };

  // 로컬 지원 양식 항목 전체를 백엔드에 교체 저장한다. (화면 순서가 곧 저장 순서)
  const syncFormFields = async (pid) => {
    await replaceFormFields(pid, {
      fields: formItems
        .filter((item) => item.label.trim())
        .map((item) => ({
          label: item.label.trim(),
          fieldType: item.type,
          required: !!item.required,
          options: isOptionType(item.type)
            ? (item.options || []).map((o) => o.trim()).filter(Boolean)
            : [],
        })),
    });
  };

  // 드래그앤드롭
  const onDragStart = (index) => { dragIndex.current = index; };
  const onDragOver = (e, index) => { e.preventDefault(); setDragOverIndex(index); };
  const onDrop = (e, index) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) { setDragOverIndex(null); return; }
    setFormItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const onDragEnd = () => { dragIndex.current = null; setDragOverIndex(null); };

  // 평가 항목 드래그앤드롭
  const onCriterionDragStart = (index) => { criterionDragIndex.current = index; };
  const onCriterionDragOver = (e, index) => { e.preventDefault(); setCriterionDragOverIndex(index); };
  const onCriterionDrop = (e, index) => {
    e.preventDefault();
    const from = criterionDragIndex.current;
    if (from === null || from === index) { setCriterionDragOverIndex(null); return; }
    setCriteriaItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    criterionDragIndex.current = null;
    setCriterionDragOverIndex(null);
  };
  const onCriterionDragEnd = () => { criterionDragIndex.current = null; setCriterionDragOverIndex(null); };

  const showDraftsBanner = !isEditMode && drafts.length > 0 && !draftsBannerDismissed && !draftId;

  return (
    <div className="p-8">
      {/* 토스트 팝업 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 헤더 */}
      <PageHeader
        breadcrumb={[
          'EvalHub',
          { label: '프로그램', onClick: () => navigate('/admin/programs') },
          ...(isEditMode
            ? [{ label: title || '프로그램', onClick: () => navigate(`/admin/programs/${programId}`) }]
            : []),
          isEditMode ? '수정' : '새 프로그램',
        ]}
        title={isEditMode ? '프로그램 수정' : '프로그램 생성'}
        subtitle={
          isEditMode
            ? '프로그램 기본 정보와 지원 양식·평가 항목을 수정합니다.'
            : '기본 정보, 지원 양식, 평가 항목을 설정합니다. 제출된 지원서는 PDF로 변환되어 보관됩니다.'
        }
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {isEditMode ? (
            <>
              <button
                onClick={() => navigate(`/admin/programs/${programId}`)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDraftSave}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? '개설 중...' : '개설하기'}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {/* 기존 draft 배너 */}
      {showDraftsBanner && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">임시 저장된 프로그램이 있습니다</p>
                <div className="mt-2 space-y-1.5">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="flex items-center gap-3">
                      <span className="text-sm text-amber-700 font-medium">
                        {draft.title || '(제목 없음)'}
                      </span>
                      {draft.applicationDeadline && (
                        <span className="text-xs text-amber-500">마감 {draft.applicationDeadline}</span>
                      )}
                      <button
                        onClick={() => { loadDraft(draft); loadCriteria(draft.id); loadFormFields(draft.id); }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer"
                      >
                        이어서 작성
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600 underline underline-offset-2 cursor-pointer"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setDraftsBannerDismissed(true)}
              className="text-amber-400 hover:text-amber-600 cursor-pointer flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

{error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 2열 레이아웃 */}
      <div
        ref={formContainerRef}
        onKeyDown={handleAdvanceOnEnter}
        className="flex gap-6 items-start"
      >

        {/* 왼쪽: 메인 폼 */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  프로그램 명
                  <span className="ml-1.5 text-xs font-normal text-red-400">필수</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(''); }}
                  placeholder="ex) AI Challenge 2026"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    지원 시작
                    <span className="ml-1.5 text-xs font-normal text-red-400">필수</span>
                  </label>
                  <DateInput
                    value={applicationStart}
                    onChange={setApplicationStart}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    지원 마감
                    <span className="ml-1.5 text-xs font-normal text-red-400">필수</span>
                  </label>
                  <DateInput
                    value={applicationDeadline}
                    onChange={setApplicationDeadline}
                  />
                </div>
              </div>
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      평가 시작
                      <span className="ml-1.5 text-xs font-normal text-red-400">필수</span>
                    </label>
                    <DateInput
                      value={evaluationStart}
                      onChange={setEvaluationStart}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      평가 마감
                      <span className="ml-1.5 text-xs font-normal text-red-400">필수</span>
                    </label>
                    <DateInput
                      value={evaluationDeadline}
                      onChange={setEvaluationDeadline}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">평가위원이 평가할 수 있는 기간을 설정하세요.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">자격 조건
                  <span className="ml-1.5 text-xs font-normal text-gray-400">선택</span>
                </label>
                <input
                  type="text"
                  value={eligibilityCriteria}
                  onChange={(e) => setEligibilityCriteria(e.target.value)}
                  placeholder="ex) 성균관대 재학생 · 2~5인 팀"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
                <p className="text-xs text-gray-400 mt-1.5">지원 자격으로 유의할 점을 입력하세요.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  설명
                  <span className="ml-1.5 text-xs font-normal text-gray-400">선택</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="프로그램에 대한 설명을 입력하세요"
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* 지원 양식 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                지원 양식
                <span className="text-xs font-normal text-red-400">필수</span>
                {formItems.length > 0 && (
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {formItems.length} 항목
                  </span>
                )}
              </h2>
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer flex items-center gap-1 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                양식 다운로드
              </button>
            </div>

            {formItems.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-400">아직 추가된 지원 양식이 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">아래 버튼으로 항목을 추가하세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {formItems.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDrop={(e) => onDrop(e, index)}
                    onDragEnd={onDragEnd}
                    className={`flex items-start gap-3 px-6 py-3.5 group transition-colors ${
                      dragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-400' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-gray-300 cursor-grab flex-shrink-0 group-hover:text-gray-400 transition-colors flex items-center gap-1 pt-1.5">
                      <DragIcon />
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Q{index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateFormItem(item.id, 'label', e.target.value)}
                          placeholder="질문 (항목 이름)"
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <select
                          value={item.type}
                          onChange={(e) => changeFormItemType(item.id, e.target.value)}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft.value} value={ft.value}>{ft.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) => updateFormItem(item.id, 'required', e.target.checked)}
                            className="accent-blue-600 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">필수</span>
                        </label>
                      </div>

                      {/* 선택지 편집기 (객관식/체크박스/드롭다운) */}
                      {isOptionType(item.type) && (
                        <div className="mt-3 space-y-2">
                          {(item.options || []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <OptionMarker type={item.type} />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(item.id, oi, e.target.value)}
                                placeholder={`옵션 ${oi + 1}`}
                                className="flex-1 min-w-0 px-2 py-1 border-b border-gray-200 text-sm focus:border-blue-500 outline-none transition-colors"
                              />
                              <button
                                onClick={() => removeOption(item.id, oi)}
                                className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-0.5 rounded hover:bg-red-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(item.id)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors ml-6"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            옵션 추가
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFormItem(item.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1 rounded hover:bg-red-50 mt-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 py-3.5 border-t border-gray-100">
              <button
                onClick={addFormItem}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                항목 추가
              </button>
            </div>
          </div>

          {/* 첨부파일 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                첨부파일
                <span className="text-xs font-normal text-gray-400">선택</span>
              </h2>
              <span className="text-xs text-gray-400">지원자 제출 파일 · PDF</span>
            </div>

            <div className="p-6">
              {/* 첨부파일 수령 여부 토글 */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">지원자 첨부파일 받기</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    켜면 지원자가 지원서에 파일을 첨부할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={attachmentsEnabled}
                  onClick={() => setAttachmentsEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    attachmentsEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      attachmentsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* 최대 개수 (첨부 허용 시에만 노출) */}
              {attachmentsEnabled && (
                <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">최대 첨부 개수</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      지원자는 최대 {Number(maxAttachments) || 1}개까지 업로드할 수 있습니다.
                    </p>
                  </div>
                  <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setMaxAttachments((v) => String(Math.max(1, (Number(v) || 1) - 1)))}
                      disabled={(Number(maxAttachments) || 1) <= 1}
                      className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={maxAttachments}
                      onChange={(e) => setMaxAttachments(e.target.value)}
                      onBlur={() => setMaxAttachments((v) => String(Math.max(1, Math.floor(Number(v) || 1))))}
                      className="w-14 text-center py-1.5 text-sm border-x border-gray-200 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxAttachments((v) => String((Number(v) || 1) + 1))}
                      className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 가산점 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                가산점
                <span className="text-xs font-normal text-gray-400">선택</span>
              </h2>
              <span className="text-xs text-gray-400">매니저 단독 평가 · 심사 점수에 가산</span>
            </div>

            <div className="p-6">
              {/* 가산점 사용 여부 토글 */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">가산점 사용</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    켜면 매니저가 팀별로 가산점을 입력하고, 심사위원 평균에 더해집니다.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bonusEnabled}
                  onClick={() => setBonusEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    bonusEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      bonusEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* 최대 가산점 (가산점 사용 시에만 노출) */}
              {bonusEnabled && (
                <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">최대 가산점</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      팀당 최대 {Number(maxBonus) || 0}점까지 부여할 수 있습니다.
                    </p>
                  </div>
                  <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setMaxBonus((v) => String(Math.max(0, (Number(v) || 0) - 1)))}
                      disabled={(Number(maxBonus) || 0) <= 0}
                      className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={maxBonus}
                      onChange={(e) => setMaxBonus(e.target.value)}
                      onBlur={() => setMaxBonus((v) => String(Math.max(0, Number(v) || 0)))}
                      className="w-14 text-center py-1.5 text-sm border-x border-gray-200 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxBonus((v) => String((Number(v) || 0) + 1))}
                      className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 평가 항목 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                평가 항목
                <span className="text-xs font-normal text-gray-400">선택</span>
                {criteriaItems.length > 0 && (
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {criteriaItems.length} 항목
                  </span>
                )}
              </h2>
              <span className="text-xs text-gray-400">점수제 · 0~10점</span>
            </div>

            {criteriaItems.length === 0 ? (
              <div className="px-6 py-11 text-center">
                <p className="text-sm text-gray-400">아직 추가된 평가 항목이 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">아래 버튼으로 항목을 추가하세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {criteriaItems.map((item, index) => (
                  <div
                    key={item.key}
                    onDragOver={(e) => onCriterionDragOver(e, index)}
                    onDrop={(e) => onCriterionDrop(e, index)}
                    onDragEnd={onCriterionDragEnd}
                    className={`px-6 py-4 group transition-colors ${
                      criterionDragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        draggable
                        onDragStart={() => onCriterionDragStart(index)}
                        className="text-gray-300 cursor-grab flex-shrink-0 group-hover:text-gray-400 transition-colors"
                      >
                        <DragIcon />
                      </div>
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Q{index + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateCriterionItem(item.key, 'name', e.target.value)}
                        placeholder="평가 항목 이름 (ex. 발표 완성도)"
                        className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-gray-400">가중치</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.weight}
                          onChange={(e) => updateCriterionItem(item.key, 'weight', e.target.value)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeCriterion(item.key)}
                        className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1 rounded hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <textarea
                      value={item.description}
                      onChange={(e) => updateCriterionItem(item.key, 'description', e.target.value)}
                      placeholder="설명 (선택) · 심사위원에게 보여줄 채점 기준·안내를 입력하세요"
                      rows={2}
                      className="mt-2 ml-16 w-[calc(100%-4rem)] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 py-3.5 border-t border-gray-100">
              <button
                onClick={addCriterion}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                평가 항목 추가
              </button>
            </div>
          </div>          
        </div>

        {/* 오른쪽: 설정 사이드바 */}
        <div className="w-72 flex-shrink-0 space-y-4">

          {/* 운영 유형 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">운영 유형</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { value: 'MODULE_A', label: '프로그램 지원/심사 시스템' },
                { value: 'MODULE_B', label: '팀/프로젝트 평가' },
              ].map((t) => (
                <label key={t.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="programType"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="mt-0.5 accent-blue-600 flex-shrink-0 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                      {t.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 지원 방식 (팀/개인) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">지원 방식</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { value: 'INDIVIDUAL', label: '개인 지원', description: '지원자가 본인 정보(이름·연락처·이메일)만 입력합니다.' },
                { value: 'TEAM', label: '팀 지원', description: '지원자가 팀 이름과 팀원 정보(이름·이메일)를 입력합니다.' },
              ].map((t) => (
                <label key={t.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="participantType"
                    value={t.value}
                    checked={participantType === t.value}
                    onChange={() => setParticipantType(t.value)}
                    className="mt-0.5 accent-blue-600 flex-shrink-0 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                      {t.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
