// 지원자 화면 공용 포맷 헬퍼
// 로그인 사용자가 필요하면 query/useCurrentUser 훅을 사용한다. (GET /api/auth/me)

// 마감일까지 남은 일수 배지 문자열 (예: 'D-6', 'D-DAY', '마감')
export function formatDday(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end - today) / 86400000);
  if (diff < 0) return '마감';
  if (diff === 0) return 'D-DAY';
  return `D-${diff}`;
}

// '2026-03-04' → '03.04'
export function formatMonthDay(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${m}.${d}`;
}

// 지원 기간 '03.04-03.31'
export function formatPeriod(start, end) {
  const s = formatMonthDay(start);
  const e = formatMonthDay(end);
  if (s && e) return `${s}-${e}`;
  return e || s || '상시';
}

// ISO datetime → '05.02 14:20' (당해년도) / '2025.11.20' (이전년도)
export function formatDateTime(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  const now = new Date();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  if (dt.getFullYear() !== now.getFullYear()) {
    return `${dt.getFullYear()}.${mm}.${dd}`;
  }
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
}

// 파일 크기 표시 (예: '4.2 MB')
export function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 파일 유형 항목 여부 (백엔드 검증 규칙과 동일)
export { isFileType as isFileField } from './formFields';
