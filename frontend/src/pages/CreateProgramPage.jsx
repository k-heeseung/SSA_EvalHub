import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  createProgram, updateProgram, publishProgram, getPrograms, deleteProgram,
  getCriteria, createCriterion, updateCriterion, deleteCriterion,
  getFormFields, replaceFormFields,
} from '../api/programs';
import PageHeader from '../components/PageHeader';
import './CreateProgramPage.css';
import { validBonusScore } from '../utils/bonus';
import { validCriterionMaxScore, totalCriterionMaxScore } from '../utils/criteria';
import ProgramScheduleSection from '../components/ProgramScheduleSection';
import ProgramApplicationPreview from '../components/ProgramApplicationPreview';
import { scheduleInput, scheduleInstant, schedulePayload, scheduleErrors as getScheduleErrors, formatScheduleTime } from '../utils/programSchedule';
import { useScheduleNow } from '../query/useScheduleNow';
import { FIELD_TYPES, normalizeFieldType, isOptionType } from '../utils/formFields';
import { queryKeys } from '../query/keys';
import { useLiveApiQuery } from '../query/useApiQuery';

let criterionKeySeq = 0;
const newCriterion = () => ({ key: `c${Date.now()}_${criterionKeySeq++}`, id: null, name: '', description: '', maxScore: '10' });

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
      <button type="button" aria-label="알림 닫기" onClick={onClose} className="ui-button ui-button--ghost ml-2 text-gray-500 hover:text-white cursor-pointer">
        닫기
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
  const [periodErrors, setPeriodErrors] = useState({});
  const [originalProgram, setOriginalProgram] = useState(null);
  const now = useScheduleNow();
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  // 편집 대상 프로그램의 현재 상태. 평가가 시작된 뒤에는 지원 마감일을 잠근다.
  const [programStatus, setProgramStatus] = useState(null);
  const [formItems, setFormItems] = useState([]);
  const [criteriaItems, setCriteriaItems] = useState([]);
  const [removedCriterionIds, setRemovedCriterionIds] = useState([]);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [maxAttachments, setMaxAttachments] = useState('1');
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusItems, setBonusItems] = useState([]);

  // 임시저장 상태
  const [draftId, setDraftId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftsBannerDismissed, setDraftsBannerDismissed] = useState(false);

  // UI 상태
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // 드래그 상태 (제출 받을 항목 / 평가 항목 각각)
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const bonusDragIndex = useRef(null);
  const [bonusDragOverIndex, setBonusDragOverIndex] = useState(null);
  const criterionDragIndex = useRef(null);
  const [criterionDragOverIndex, setCriterionDragOverIndex] = useState(null);
  const formContainerRef = useRef(null);

  const hydrateBonusItems = (program) => setBonusItems((program.bonusItems ?? []).map((item) => ({
    ...item, key: `bonus-${item.id}`, maxScore: item.maxScore == null ? '' : String(Number(item.maxScore)),
  })));

  // draft 이어서 작성
  const loadDraft = (draft) => {
    setDraftId(draft.id);
    setOriginalProgram(draft);
    setPeriodErrors({});
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    setType(draft.type || 'MODULE_A');
    setParticipantType(draft.participantType || 'INDIVIDUAL');
    setApplicationStart(scheduleInput(scheduleInstant(draft, 'applicationStart')));
    setApplicationDeadline(scheduleInput(scheduleInstant(draft, 'applicationDeadline')));
    setEvaluationStart(scheduleInput(scheduleInstant(draft, 'evaluationStart')));
    setEvaluationDeadline(scheduleInput(scheduleInstant(draft, 'evaluationDeadline')));
    setEligibilityCriteria(draft.eligibilityCriteria || '');
    setProgramStatus(draft.status || null);
    setAttachmentsEnabled(!!draft.attachmentsEnabled);
    setMaxAttachments(draft.maxAttachments != null ? String(draft.maxAttachments) : '1');
    setBonusEnabled(!!draft.bonusEnabled);
    hydrateBonusItems(draft);
    setDraftsBannerDismissed(true);
  };

  // 기존 프로그램의 제출 항목을 폼에 로드한다.
  const loadFormFields = (id) => {
    queryClient.fetchQuery({
      queryKey: queryKeys.formFields(id),
      queryFn: async () => (await getFormFields(id)).data,
    })
      .then((data) => {
        setFormItems(
          data.map((f) => ({
            id: f.id,
            serverId: f.id, // 저장 시 이 id로 기존 항목을 제자리 수정한다. (답변 보존)
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
            maxScore: c.maxScore != null ? String(Number(c.maxScore)) : '10',
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

  const addBonusItem = () => setBonusItems((items) => [...items, {
    key: `new-bonus-${Date.now()}-${criterionKeySeq++}`, id: null, name: '', maxScore: '5',
  }]);
  const updateBonusItem = (key, field, value) => setBonusItems((items) => items.map((item) =>
    item.key === key ? { ...item, [field]: value } : item));
  const validateBonus = () => {
    if (bonusEnabled && (!bonusItems.length || bonusItems.some((item) => {
      const original = originalProgram?.bonusItems?.find((old) => old.id === item.id);
      return !item.name.trim() || item.name.trim().length > 255
        || (item.maxScore === '' && !(original && original.maxScore == null))
        || !validBonusScore(item.maxScore, null);
    }))) {
      showToast('가산점 항목명과 최대 점수(0 이상, 소수 첫째 자리까지)를 입력해주세요.', 'error');
      return false;
    }
    return true;
  };

  const formData = () => ({
    title,
    description,
    type,
    managerId: null,
    ...schedulePayload({ applicationStart, applicationDeadline, evaluationStart, evaluationDeadline }, originalProgram),
    eligibilityCriteria: eligibilityCriteria || null,
    attachmentsEnabled,
    maxAttachments: attachmentsEnabled ? (Number(maxAttachments) || 1) : null,
    bonusEnabled,
    bonusItems: bonusEnabled ? bonusItems.map((item) => ({ id: item.id, name: item.name.trim(), maxScore: item.maxScore === '' ? null : Number(item.maxScore) })) : undefined,
    participantType,
  });

  const extractError = (err) =>
    err.response?.data?.message
    || err.response?.data?.error
    || err.message
    || '요청에 실패했습니다.';

  const latestProgram = (programsQuery.data ?? []).find((program) => program.id === (Number(programId) || draftId));
  const criteriaLocked = latestProgram?.evaluationStarted ?? originalProgram?.evaluationStarted ?? false;
  const bonusLocked = criteriaLocked;
  const latestStatus = latestProgram?.status ?? programStatus;
  const evaluationStartsAt = Date.parse(scheduleInstant(latestProgram ?? originalProgram, 'evaluationStart'));
  const applicationDeadlineLocked = latestStatus === 'ACTIVE' || latestStatus === 'INACTIVE'
    || (!!latestStatus && latestStatus !== 'DRAFT' && Number.isFinite(evaluationStartsAt) && now >= evaluationStartsAt);

  const validateDates = ({ required = false } = {}) => {
    const errors = getScheduleErrors({ applicationStart, applicationDeadline, evaluationStart, evaluationDeadline },
      { required, original: originalProgram });
    setPeriodErrors(errors);
    if (Object.keys(errors).length) {
      showToast(Object.values(errors)[0], 'error');
      return false;
    }
    return true;
  };

  const handleAdvanceOnEnter = useCallback((e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const target = e.target;
    if (target.closest('dialog')) return;
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
    if (!validateBonus()) return;
    if (!validateDates()) return;
    if (hasIncompleteCriterion()) { showToast('평가 기준 이름을 입력해주세요.', 'error'); return; }
    if (criteriaItems.some((c) => c.name.trim() && !validCriterionMaxScore(c.maxScore))) { showToast('배점은 0보다 크고 999999.9 이하인 소수 첫째 자리까지 입력해주세요.', 'error'); return; }
    setSaving(true);
    setError('');
    try {
      let pid;
      if (draftId) {
        const res = await updateProgram(draftId, formData());
        setOriginalProgram(res.data);
        hydrateBonusItems(res.data);
        setDrafts((prev) => prev.filter((draft) => draft.id !== draftId).concat(res.data));
        pid = draftId;
      } else {
        const res = await createProgram({ ...formData(), status: 'DRAFT' });
        setDraftId(res.data.id);
        setOriginalProgram(res.data);
        hydrateBonusItems(res.data);
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
      loadFormFields(pid); // 저장된 제출 항목의 id로 갱신한다.
      showToast('임시 저장되었습니다.');
    } catch (err) {
      setError(`임시 저장 실패: ${extractError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // 이름 없이 다른 값만 입력된 평가 항목이 있는지 검증
  const hasIncompleteCriterion = () =>
    criteriaItems.some((c) => !c.name.trim() && (c.description.trim() || String(c.maxScore) !== '10'));

  // 수정 저장 (편집 모드)
  const handleEditSave = async () => {
    if (!title.trim())        { showToast('프로그램 명을 입력해주세요.', 'error'); return; }
    if (!validateBonus()) return;
    if (!validateDates({ required: true })) return;
    if (hasEmptyOptionField()) { showToast('선택지 유형 항목에 선택지를 최소 1개 입력해주세요.', 'error'); return; }
    if (hasIncompleteCriterion()) { showToast('평가 기준 이름을 입력해주세요.', 'error'); return; }
    if (criteriaItems.some((c) => c.name.trim() && !validCriterionMaxScore(c.maxScore))) { showToast('배점은 0보다 크고 999999.9 이하인 소수 첫째 자리까지 입력해주세요.', 'error'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await updateProgram(Number(programId), formData());
      setOriginalProgram(res.data);
      hydrateBonusItems(res.data);
      await syncCriteria(Number(programId));
      await syncFormFields(Number(programId));
      navigate(`/admin/programs/${programId}`);
    } catch (err) {
      setError(`저장 실패: ${extractError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // 구성 저장이 모두 성공한 뒤 개설한다. 실제 상태는 서버가 기간으로 계산한다.
  const handleCreate = async () => {
    if (!title.trim())          { showToast('프로그램 명을 입력해주세요.', 'error'); return; }
    if (!validateBonus()) return;
    if (!validateDates({ required: true })) return;
    if (hasEmptyOptionField()) { showToast('선택지 유형 항목에 선택지를 최소 1개 입력해주세요.', 'error'); return; }
    if (hasIncompleteCriterion()) { showToast('평가 기준 이름을 입력해주세요.', 'error'); return; }
    if (criteriaItems.some((c) => c.name.trim() && !validCriterionMaxScore(c.maxScore))) { showToast('배점은 0보다 크고 999999.9 이하인 소수 첫째 자리까지 입력해주세요.', 'error'); return; }
    setSubmitting(true);
    setError('');
    try {
      let pid;
      if (draftId) {
        const res = await updateProgram(draftId, formData());
        setOriginalProgram(res.data);
        hydrateBonusItems(res.data);
        pid = draftId;
      } else {
        const res = await createProgram({ ...formData(), status: 'DRAFT' });
        setDraftId(res.data.id);
        setOriginalProgram(res.data);
        hydrateBonusItems(res.data);
        pid = res.data.id;
      }
      await syncCriteria(pid);
      await syncFormFields(pid);
      await publishProgram(pid);
      navigate('/admin/programs');
    } catch (err) {
      setError(`생성 실패: ${extractError(err)}`);
      setSubmitting(false);
    }
  };

  // 제출 받을 항목
  // id는 화면 조작용 로컬 key다. serverId가 null이면 아직 저장되지 않은 새 항목을 뜻한다.
  const addFormItem = () => {
    setFormItems((prev) => [
      ...prev,
      { id: Date.now(), serverId: null, label: '', required: false, type: 'SHORT_TEXT', options: [] },
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
    if (criteriaLocked) return;
    setCriteriaItems((prev) => [...prev, newCriterion()]);
  };

  const updateCriterionItem = (key, field, value) => {
    setCriteriaItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const removeCriterion = (key) => {
    if (criteriaLocked) return;
    setCriteriaItems((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target?.id) setRemovedCriterionIds((ids) => [...ids, target.id]);
      return prev.filter((item) => item.key !== key);
    });
  };

  // 로컬 평가 항목을 백엔드에 반영한다. (삭제 → 수정/생성, displayOrder는 화면 순서)
  const syncCriteria = async (pid) => {
    await Promise.all(removedCriterionIds.map((cid) => deleteCriterion(pid, cid)));
    await Promise.all(
      criteriaItems
        .filter((item) => item.name.trim())
        .map((item, index) => {
          const payload = {
            name: item.name.trim(),
            description: item.description.trim() || null,
            maxScore: Number(item.maxScore),
            displayOrder: index + 1,
          };
          return item.id
            ? updateCriterion(pid, item.id, payload)
            : createCriterion(pid, payload);
        })
    );
  };

  // 로컬 제출 항목을 백엔드에 저장한다. (화면 순서가 곧 저장 순서)
  // 기존 항목은 serverId를 함께 보내 제자리 수정되게 한다. id 없이 보내면 서버가 새 항목으로 보고
  // 기존 항목을 삭제하게 되는데, 그러면 지원자가 제출한 답변까지 cascade로 사라진다.
  const syncFormFields = async (pid) => {
    await replaceFormFields(pid, {
      fields: formItems
        .filter((item) => item.label.trim())
        .map((item) => ({
          id: item.serverId ?? null,
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

  const onBonusDrop = (e, index) => {
    e.preventDefault();
    const from = bonusDragIndex.current;
    if (from !== null && from !== index) {
      setBonusItems((items) => {
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(index, 0, moved);
        return next;
      });
    }
    bonusDragIndex.current = null;
    setBonusDragOverIndex(null);
  };
  const onBonusDragEnd = () => { bonusDragIndex.current = null; setBonusDragOverIndex(null); };

  // 평가 항목 드래그앤드롭
  const onCriterionDragStart = (index) => { criterionDragIndex.current = index; };
  const onCriterionDragOver = (e, index) => { e.preventDefault(); setCriterionDragOverIndex(index); };
  const onCriterionDrop = (e, index) => {
    e.preventDefault();
    if (criteriaLocked) return;
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
    <div className="ui-page program-editor">
      {/* 토스트 팝업 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 헤더 */}
      <PageHeader
        stackOnSmall
        breadcrumb={[
          '평가ON',
          { label: '프로그램', onClick: () => navigate('/admin/programs') },
          ...(isEditMode
            ? [{ label: title || '프로그램', onClick: () => navigate(`/admin/programs/${programId}`) }]
            : []),
          isEditMode ? '수정' : '새 프로그램',
        ]}
        title={isEditMode ? '프로그램 수정' : '프로그램 생성'}
        subtitle={
          isEditMode
            ? '프로그램 기본 정보와 제출 받을 항목·평가 기준을 수정합니다.'
            : '프로그램 정보와 지원서·평가 항목을 설정하세요.'
        }
      >
      </PageHeader>

      {/* 기존 draft 배너 */}
      {showDraftsBanner && (
        <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-800">임시 저장된 프로그램이 있습니다</p>
                <div className="mt-2 space-y-1.5">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="w-full min-w-0 text-sm text-amber-700 font-medium sm:w-auto">
                        {draft.title || '(제목 없음)'}
                      </span>
                      {scheduleInstant(draft, 'applicationDeadline') && (
                        <span className="w-full text-xs text-amber-500 sm:w-auto">마감 {formatScheduleTime(scheduleInstant(draft, 'applicationDeadline'))}</span>
                      )}
                      <div className="flex flex-none items-center gap-1 whitespace-nowrap">
                      <button
                        onClick={() => { loadDraft(draft); loadCriteria(draft.id); loadFormFields(draft.id); }}
                        className="ui-button ui-button--ghost px-2 text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer"
                      >
                        이어서 작성
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="ui-button ui-button--ghost px-2 text-xs font-medium text-red-500 hover:text-red-600 underline underline-offset-2 cursor-pointer"
                      >
                        삭제
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button" aria-label="임시 저장 안내 닫기"
              onClick={() => setDraftsBannerDismissed(true)}
              className="ui-button ui-button--ghost text-amber-400 hover:text-amber-600 cursor-pointer flex-shrink-0"
            >
              닫기
            </button>
          </div>
        </div>
      )}

{error && (
        <div className="mb-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 2열 레이아웃 */}
      <div
        ref={formContainerRef}
        onKeyDown={handleAdvanceOnEnter}
        className="program-editor-layout"
      >

        {/* 왼쪽: 메인 폼 */}
        <div className="program-editor-main">

          <section className="program-editor-group" aria-labelledby="program-basics-heading">
            <h2 id="program-basics-heading" className="program-editor-section-title">기본 정보</h2>
            <div className="program-editor-surface program-editor-basic-fields">
              <div className="program-editor-basic-row">
                <div className="program-editor-field"><label htmlFor="program-title">프로그램 명<span className="program-editor-required">필수</span></label>
                  <input id="program-title" className="ui-input" value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} placeholder="예: AI 프로젝트 실증 지원 프로그램" /></div>
                <div className="program-editor-field"><label htmlFor="program-category">프로그램 분류</label>
                  <select id="program-category" className="ui-input" value={type} onChange={(e) => setType(e.target.value)}><option value="MODULE_A">프로그램 지원/심사 시스템</option><option value="MODULE_B">팀/프로젝트 평가</option></select>
                  <p className="program-editor-help">목록에서 프로그램을 구분할 때 사용합니다.</p></div>
              </div>
              <div className="program-editor-field"><label htmlFor="program-description">프로그램 설명 <span className="program-editor-optional">선택</span></label><textarea id="program-description" className="ui-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="프로그램의 목적과 지원 내용을 입력하세요." /></div>
              <div className="program-editor-field"><label htmlFor="program-eligibility">지원 자격 <span className="program-editor-optional">선택</span></label><input id="program-eligibility" className="ui-input" value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} placeholder="예: 성균관대학교 재학생 2~5인 팀" /></div>
            </div>
          </section>

          <section className="program-editor-group" aria-labelledby="program-application-heading">
            <div className="program-editor-heading-row"><h2 id="program-application-heading" className="program-editor-section-title">지원서 구성</h2><ProgramApplicationPreview title={title} participantType={participantType} fields={formItems} attachmentsEnabled={attachmentsEnabled} maxAttachments={maxAttachments} /></div>
            <div className="program-editor-surface">
              <div className="program-editor-participant">
                <h3>지원 방식</h3>
                <div className="program-editor-choices" role="group" aria-label="지원 방식">
                  {[{ value: 'INDIVIDUAL', label: '개인 지원', description: '이름·연락처·이메일을 받습니다.' }, { value: 'TEAM', label: '팀 지원', description: '팀 이름과 팀원 정보를 함께 받습니다.' }].map((option) => <label key={option.value} className="program-editor-option"><input type="radio" name="participantType" value={option.value} checked={participantType === option.value} onChange={() => setParticipantType(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}
                </div>
                <p className="program-editor-help">기본 정보: 지원자 이름·연락처·이메일{participantType === 'TEAM' ? ', 팀 이름·팀원 정보' : ''}</p>
              </div>
          {/* 제출 받을 항목 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                제출 받을 항목
                <span className="text-xs font-normal text-gray-500">선택</span>
                {formItems.length > 0 && (
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {formItems.length} 항목
                  </span>
                )}
              </h3>

            </div>

            {formItems.length === 0 ? (
              <div className="program-editor-empty">
                <p className="text-sm text-gray-500">등록된 제출 항목이 없습니다. 항목 없이도 프로그램을 개설할 수 있습니다.</p>
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
                    <div className="text-gray-300 cursor-grab flex-shrink-0 group-hover:text-gray-500 transition-colors flex items-center gap-1 pt-1.5">
                      <DragIcon />
                      <span className="text-xs tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Q{index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="program-editor-question-fields">
                        <input
                          type="text"
                          aria-label={`지원 항목 ${index + 1} 이름`} value={item.label}
                          onChange={(e) => updateFormItem(item.id, 'label', e.target.value)}
                          placeholder="질문 (항목 이름)"
                          className="ui-input flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <select
                          aria-label={`지원 항목 ${index + 1} 응답 방식`} value={item.type}
                          onChange={(e) => changeFormItemType(item.id, e.target.value)}
                          className="ui-input px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft.value} value={ft.value}>{({ SHORT_TEXT: '짧은 글', LONG_TEXT: '긴 글', RADIO: '하나 선택', CHECKBOX: '여러 개 선택' })[ft.value] || ft.label}</option>
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
                            <div key={oi} className="flex flex-wrap items-center gap-2">
                              <OptionMarker type={item.type} />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(item.id, oi, e.target.value)}
                                placeholder={`옵션 ${oi + 1}`}
                                className="ui-input flex-1 min-w-0 px-2 py-1 border-b border-gray-200 text-sm focus:border-blue-500 outline-none transition-colors"
                              />
                              <button
                                type="button" aria-label={`지원 항목 ${index + 1} 선택지 ${oi + 1} 삭제`}
                                onClick={() => removeOption(item.id, oi)}
                                className="ui-button ui-button--ghost flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-0.5 rounded hover:bg-red-50"
                              >
                                삭제
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(item.id)}
                            className="ui-button ui-button--ghost flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors ml-6"
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
                      type="button" aria-label={`지원 항목 ${index + 1} 삭제`} onClick={() => removeFormItem(item.id)}
                      className="ui-button ui-button--ghost flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1 rounded hover:bg-red-50 mt-0.5"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="program-editor-add-row">
              <button
                onClick={addFormItem}
                className="ui-button ui-button--ghost program-editor-add-button flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                항목 추가
              </button>
            </div>
          </div>

          <div className="program-editor-attachments">
            <label className="program-editor-check"><input type="checkbox" checked={attachmentsEnabled} onChange={(e) => setAttachmentsEnabled(e.target.checked)} />PDF 첨부 받기</label>
            <div className="program-editor-attachment-count"><label htmlFor="program-max-attachments">최대 첨부 개수</label><input id="program-max-attachments" className="ui-input" type="number" min="1" disabled={!attachmentsEnabled} value={maxAttachments} onChange={(e) => setMaxAttachments(e.target.value)} onBlur={() => setMaxAttachments((value) => String(Math.max(1, Math.floor(Number(value) || 1))))} /><span>개</span></div>
          </div>
            </div>
          </section>
          <ProgramScheduleSection values={{ applicationStart, applicationDeadline, evaluationStart, evaluationDeadline }} originalProgram={originalProgram} deadlineLocked={applicationDeadlineLocked} errors={periodErrors} onChange={(field, value) => { ({ applicationStart: setApplicationStart, applicationDeadline: setApplicationDeadline, evaluationStart: setEvaluationStart, evaluationDeadline: setEvaluationDeadline })[field](value); setPeriodErrors({}); }} />

          <section className="program-editor-group" aria-labelledby="program-evaluation-heading">
            <h2 id="program-evaluation-heading" className="program-editor-section-title">평가 설정</h2>
            <div className="program-editor-surface">
          {criteriaLocked && <p className="text-xs text-gray-500">심사가 시작되어 배점과 항목 구성은 변경할 수 없습니다.</p>}
          {/* 평가 항목 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                평가 기준
                <span className="text-xs font-normal text-gray-500">선택</span>
                {criteriaItems.length > 0 && (
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {criteriaItems.length} 항목
                  </span>
                )}
              </h3>
              <span className="text-xs text-gray-500">총 배점 {totalCriterionMaxScore(criteriaItems)}점</span>
            </div>

            {criteriaItems.length === 0 ? (
              <div className="program-editor-empty">
                <p className="text-sm text-gray-500">아직 추가된 평가 기준이 없습니다.</p>
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
                        draggable={!criteriaLocked}
                        onDragStart={() => onCriterionDragStart(index)}
                        className="text-gray-300 cursor-grab flex-shrink-0 group-hover:text-gray-500 transition-colors"
                      >
                        <DragIcon />
                      </div>
                      <span className="text-xs tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Q{index + 1}
                      </span>
                      <input
                        type="text"
                        aria-label={`평가 기준 ${index + 1} 이름`} value={item.name}
                        onChange={(e) => updateCriterionItem(item.key, 'name', e.target.value)}
                        placeholder="평가 기준 이름 (ex. 발표 완성도)"
                        className="ui-input flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-gray-500">배점</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          max="999999.9"
                          disabled={criteriaLocked}
                          value={item.maxScore}
                          onChange={(e) => updateCriterionItem(item.key, 'maxScore', e.target.value)}
                          aria-label={`항목 배점 ${index + 1}`}
                          className="ui-input w-24 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                        />
                      </div>
                      <button
                        type="button" aria-label={`평가 기준 ${index + 1} 삭제`}
                        disabled={criteriaLocked}
                        onClick={() => removeCriterion(item.key)}
                        className="ui-button ui-button--ghost flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1 rounded hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                    <textarea
                      aria-label={`평가 기준 ${index + 1} 설명`} value={item.description}
                      onChange={(e) => updateCriterionItem(item.key, 'description', e.target.value)}
                      placeholder="설명 (선택) · 심사위원에게 보여줄 채점 기준·안내를 입력하세요"
                      rows={2}
                      className="ui-input mt-2 ml-16 w-[calc(100%-4rem)] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="program-editor-add-row">
              <button
                disabled={criteriaLocked} onClick={addCriterion}
                className="ui-button ui-button--ghost program-editor-add-button flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                평가 기준 추가
              </button>
            </div>
          </div>
          {/* 가산점 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                가산점
                <span className="text-xs font-normal text-gray-500">선택</span>
              </h3>
              <span className="text-xs text-gray-500">매니저 단독 평가 · 심사 점수에 가산</span>
            </div>

            <div className="p-6">
              <label className="program-editor-check"><input type="checkbox" checked={bonusEnabled} disabled={bonusLocked && bonusEnabled} onChange={(e) => { setBonusEnabled(e.target.checked); if (e.target.checked && bonusItems.length === 0) addBonusItem(); }} />매니저 가산점 사용</label>
              <p className="program-editor-help program-editor-bonus-help">심사위원 평균 점수에 매니저가 입력한 가산점을 더합니다.</p>
            </div>
            {bonusEnabled && (
              <>
                {bonusLocked && <p className="px-6 pb-3 text-xs text-amber-700">심사가 시작되어 기존 항목 삭제와 최대 점수 축소, 가산점 사용 해제가 제한됩니다.</p>}
                {(
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {bonusItems.map((item, index) => {
                      const original = (latestProgram ?? originalProgram)?.bonusItems?.find((old) => old.id === item.id);
                      const locked = bonusLocked && !!original;
                      return (
                        <div key={item.key}
                          onDragOver={(e) => { if (bonusDragIndex.current !== null) { e.preventDefault(); setBonusDragOverIndex(index); } }}
                          onDrop={(e) => onBonusDrop(e, index)} onDragEnd={onBonusDragEnd}
                          className={`px-6 py-4 group transition-colors ${bonusDragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-400' : ''}`}>
                          <div className="program-editor-bonus-row">
                            <div draggable onDragStart={(e) => { bonusDragIndex.current = index; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.key); }}
                              title="드래그하여 순서 변경" aria-label={`가산점 항목 ${index + 1} 순서 변경`}
                              className="text-gray-300 cursor-grab flex-shrink-0 group-hover:text-gray-500 transition-colors">
                              <DragIcon />
                            </div>
                            <span className="text-xs tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">B{index + 1}</span>
                            <label className="program-editor-bonus-name">가산점 항목
                            <input type="text" aria-label={`가산점 항목명 ${index + 1}`} value={item.name} maxLength={255}
                              onChange={(e) => updateBonusItem(item.key, 'name', e.target.value)}
                              placeholder="가산점 항목 이름 (ex. 사전 교육 수료)"
                              className="ui-input flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </label>
                            <label className="program-editor-bonus-score">
                              <span>최대 점수</span>
                              <input type="number" step="0.1" min={locked && original.maxScore != null ? Number(original.maxScore) : 0}
                                max="99999999.9" aria-label={`가산점 최대 점수 ${index + 1}`} value={item.maxScore}
                                disabled={locked && original.maxScore == null} placeholder={original?.maxScore == null && item.id ? '상한 없음' : ''}
                                onChange={(e) => updateBonusItem(item.key, 'maxScore', e.target.value)}
                                onBlur={() => { if (locked && original.maxScore != null && (item.maxScore === '' || Number(item.maxScore) < Number(original.maxScore))) updateBonusItem(item.key, 'maxScore', String(original.maxScore)); }}
                                className="ui-input w-24 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                            </label>
                            <button type="button" disabled={locked} aria-label={`가산점 항목 ${index + 1} 삭제`}
                              title={locked ? '심사가 시작되어 삭제할 수 없습니다.' : '가산점 항목 삭제'}
                              onClick={() => setBonusItems((items) => items.filter((v) => v.key !== item.key))}
                              className="ui-button ui-button--ghost flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-1 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-300 disabled:hover:bg-transparent">
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="px-6 py-3.5 border-t border-gray-100">
                  <button type="button" onClick={addBonusItem}
                    className="ui-button ui-button--ghost flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    가산점 항목 추가
                  </button>
                </div>
              </>
            )}
          </div>

            </div>
          </section>
        </div>

        <div className="program-editor-footer" role="group" aria-label={isEditMode ? '프로그램 수정 완료' : '프로그램 생성 완료'}>
          {isEditMode ? <>
              <button
                onClick={() => navigate(`/admin/programs/${programId}`)}
                className="ui-button ui-button--ghost px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="ui-button ui-button--primary px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
          </> : <>
              <button
                onClick={handleDraftSave}
                disabled={saving}
                className="ui-button ui-button--ghost px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="ui-button ui-button--primary px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? '개설 중...' : '개설하기'}
              </button>
          </>}
        </div>
      </div>
    </div>
  );
}
