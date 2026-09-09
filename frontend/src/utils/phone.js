// 전화번호 정규화/표시 유틸. 백엔드 PhoneNumbers.java와 같은 규칙을 사용한다.
//
// 저장은 숫자만 남긴 형태(01012345678), 표시는 하이픈 형태(010-1234-5678).
// 입력은 자유 형식을 허용하되 타이핑하는 동안 자동으로 하이픈을 붙여준다.
// 한쪽 규칙만 바꾸면 저장된 값과 화면 표시가 어긋나므로 백엔드와 함께 수정해야 한다.

// 자유 입력 → 숫자만 남긴 저장 형태. 값이 없으면 빈 문자열.
export function toDigits(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  let digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  // 국가번호 표기(+82 10-1234-5678)는 국내 표기(01012345678)로 바꾼다.
  if (trimmed.startsWith('+') && digits.startsWith('82')) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

// 국내 번호만 지원한다. 0으로 시작하는 9~11자리 또는 1로 시작하는 8자리 대표번호.
export function isValidPhone(raw) {
  const d = toDigits(raw);
  if (!d) return false;
  if (d.startsWith('0')) return d.length >= 9 && d.length <= 11;
  if (d.startsWith('1')) return d.length === 8;
  return false;
}

// 저장 형태 → 화면 표시용 하이픈 형식. 알 수 없는 형태면 원본을 그대로 돌려준다.
export function formatPhone(value) {
  const d = toDigits(value);
  if (!d) return '';
  if (d.length === 8 && d.startsWith('1')) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.startsWith('02')) {
    // 서울 지역번호는 2자리. 국번이 3자리(9자리)인 옛 번호도 있다.
    if (d.length === 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`;
    if (d.length === 10) return `02-${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return d;
}

// 입력 중 자동 하이픈. 아직 다 입력하지 않은 번호도 부분적으로 포맷한다.
export function formatPhoneInput(raw) {
  const d = toDigits(raw).slice(0, 11);
  if (!d) return '';

  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `02-${d.slice(2)}`;
    return `02-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.startsWith('01')) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  }
  if (d.startsWith('1')) {
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
}
