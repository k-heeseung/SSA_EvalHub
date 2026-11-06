import { bonusSummary } from './bonus.js';
// 평가 결과 내보내기 유틸 — ExcelJS로 .xlsx 다운로드 지원.
import ExcelJS from 'exceljs';

const RESULT_LABEL = { PASSED: '합격', FAILED: '불합격', PENDING: '미정' };

const submittedEvals = (team) =>
  team.evaluations.filter((e) => e.submission?.status === 'SUBMITTED');

// 심사위원 평균(가산점 제외). 제출된 평가가 없으면 null.
export function teamAverage(team) {
  const submitted = submittedEvals(team);
  if (submitted.length === 0) return null;
  const sum = submitted.reduce((s, e) => s + Number(e.submission.totalScore), 0);
  return sum / submitted.length;
}

// 매니저가 부여한 가산점. 없으면 0.
export function teamBonus(team) {
  if (Array.isArray(team.bonusScores)) return bonusSummary(team.bonusScores).total ?? 0;
  return team.bonusScore != null ? Number(team.bonusScore) : 0;
}

// 최종 점수 = 심사위원 평균 + 가산점. 평가·가산점이 모두 없으면 null.
export function teamFinalScore(team) {
  const base = teamAverage(team);
  if (base == null && (Array.isArray(team.bonusScores) ? bonusSummary(team.bonusScores).total == null : team.bonusScore == null)) return null;
  return (base ?? 0) + teamBonus(team);
}

// 최종 점수 내림차순 정렬 + base(avg)/bonus/final 부착. 값이 없는 팀은 뒤로.
export function rankedTeams(results) {
  return [...results]
    .map((t) => ({ ...t, avg: teamAverage(t), bonus: teamBonus(t), final: teamFinalScore(t) }))
    .sort((a, b) => (b.final ?? -1) - (a.final ?? -1));
}

const sanitize = (name) => (name || 'export').replace(/[\\/:*?"<>|]/g, '_').trim();

// 숫자로 다룰 수 있으면 Number로, 아니면 빈 문자열로 (엑셀 셀이 숫자 타입이 되도록).
const numOrBlank = (v) => (v == null || v === '' ? '' : Number(v));
const roundedOrBlank = (v) => (v == null ? '' : Number(v.toFixed(1)));

// 2차원 배열(첫 행은 항목 이름 헤더)을 시트 하나짜리 .xlsx 파일로 다운로드한다.
// 1행은 굵게 처리하고 스크롤 시 고정(freeze)한다.
async function downloadSheet(filename, sheetName, aoa) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }], // 1행(항목 이름) 고정
  });
  ws.addRows(aoa);
  ws.getRow(1).font = { bold: true };
  // 열 너비를 내용 길이에 맞춰 자동 조정.
  aoa[0].forEach((_, c) => {
    ws.getColumn(c + 1).width = Math.min(40, Math.max(8, ...aoa.map((r) => String(r[c] ?? '').length + 2)));
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 심사위원 표시명 — 이름이 있으면 이름, 없으면 이메일로 대체.
const evaluatorLabel = (e) => e.evaluatorName || e.evaluatorEmail;

// 전체 팀 · 심사위원별 총점 (Excel). 가산점을 사용하는 프로그램만 가산점/총합 열을 추가한다.
export function exportAllTeamsExcel(programTitle, results) {
  // 동명이인이 있어도 열이 섞이지 않도록 evaluatorId로 열을 구분하고, 표시는 이름으로 한다.
  const evaluators = [];
  const seen = new Set();
  for (const t of results) {
    for (const e of t.evaluations) {
      if (!seen.has(e.evaluatorId)) {
        seen.add(e.evaluatorId);
        evaluators.push({ id: e.evaluatorId, label: evaluatorLabel(e) });
      }
    }
  }
  const bonusItems = results.find((t) => t.bonusScores?.length)?.bonusScores ?? [];
  const hasBonus = bonusItems.length > 0 || results.some((t) => t.bonusScore != null);
  const header = ['순위', '팀명', ...evaluators.map((e) => e.label), '평균', ...bonusItems.map((item) => `가산점: ${item.name}`), ...(hasBonus ? ['가산점 합계', '총합'] : []), '판정'];
  const rows = rankedTeams(results).map((t, i) => {
    const scoreById = Object.fromEntries(
      submittedEvals(t).map((e) => [e.evaluatorId, e.submission.totalScore]),
    );
    return [
      i + 1,
      t.teamName,
      ...evaluators.map((e) => numOrBlank(scoreById[e.id])),
      roundedOrBlank(t.avg),
      ...bonusItems.map((item) => numOrBlank(t.bonusScores?.find((v) => v.itemId === item.itemId)?.score)),
      ...(hasBonus ? [
        numOrBlank(t.bonusScore),
        roundedOrBlank(t.final),
      ] : []),
      RESULT_LABEL[t.teamStatus] ?? '',
    ];
  });
  return downloadSheet(`${sanitize(programTitle)}_전체평가.xlsx`, '전체 평가', [header, ...rows]);
}

// 최종 결과 · 합격자만 (Excel)
export function exportFinalExcel(programTitle, results) {
  const bonusItems = results.find((t) => t.bonusScores?.length)?.bonusScores ?? [];
  const hasBonus = bonusItems.length > 0 || results.some((t) => t.bonusScore != null);
  const ranked = rankedTeams(results).filter((t) => t.teamStatus === 'PASSED');
  const header = ['순위', '팀명', ...(hasBonus ? ['심사위원 평균', ...bonusItems.map((item) => `가산점: ${item.name}`), '가산점 합계'] : []), '최종 점수', '판정'];
  const rows = ranked.map((t, i) => [
    i + 1,
    t.teamName,
    ...(hasBonus ? [
      roundedOrBlank(t.avg),
      ...bonusItems.map((item) => numOrBlank(t.bonusScores?.find((v) => v.itemId === item.itemId)?.score)),
      numOrBlank(t.bonusScore),
    ] : []),
    roundedOrBlank(t.final),
    '합격',
  ]);
  return downloadSheet(`${sanitize(programTitle)}_최종합격.xlsx`, '최종 합격', [header, ...rows]);
}
