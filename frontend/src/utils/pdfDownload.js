// 서버가 생성한 PDF를 Excel과 동일한 브라우저 다운로드 흐름으로 저장한다.
export async function downloadPdfResponse(response, fallbackName = '평가결과.pdf') {
  const blob = response.data;
  if (!(blob instanceof Blob) || await blob.slice(0, 5).text() !== '%PDF-') {
    throw new Error('올바른 PDF 파일이 아닙니다.');
  }
  const disposition = response.headers['content-disposition'] || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = fallbackName;
  if (encoded) {
    try { filename = decodeURIComponent(encoded); } catch { /* 기본 파일명 사용 */ }
  }
  // 파일명은 헤더에서도 경로 문자와 제어 문자를 허용하지 않는다.
  filename = Array.from(filename, (character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('').replace(/[\\/:*?"<>|]/g, '_');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
