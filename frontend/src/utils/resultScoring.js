export const RESULT_METHODS = { ALL: '전체 평균', TRIMMED: '최고·최저 제외 평균' };

function cents(value) {
  if (value == null || value === '') return null;
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) : null;
}

export function calculateResult(team, method = 'ALL') {
  const evaluations = team.evaluations ?? [];
  const submitted = evaluations.filter(e => e.submission?.status === 'SUBMITTED');
  const bonusItems = team.bonusScores ?? [];
  const rawBonusCents = bonusItems.length
    ? bonusItems.reduce((sum, item) => sum + (cents(item.score) ?? 0n), 0n)
    : cents(team.bonusScore) ?? 0n;
  const bonusCents = ((rawBonusCents + 5n) / 10n) * 10n;
  const base = { ...team, submittedCount: submitted.length, assignedCount: evaluations.length, excludedIndices: [], usedCount: 0, avg: null, final: null, bonus: Number(bonusCents) / 100, rank: null };
  if (!evaluations.length) return { ...base, unavailableReason: '심사위원 미배정' };
  if (submitted.length !== evaluations.length) return { ...base, unavailableReason: `심사 ${evaluations.length - submitted.length}명 미제출` };
  if (method === 'TRIMMED' && submitted.length <= 2) return { ...base, unavailableReason: '제출 심사위원 2명 이하' };
  const scores = evaluations.map(e => cents(e.submission.totalScore));
  if (scores.some(score => score == null)) return { ...base, unavailableReason: '심사 점수 확인 필요' };
  const excludedIndices = [];
  if (method === 'TRIMMED') {
    const min = scores.reduce((best, score, index) => score < scores[best] ? index : best, 0);
    excludedIndices.push(min);
    let max = min === 0 ? 1 : 0;
    scores.forEach((score, index) => { if (index !== min && score > scores[max]) max = index; });
    excludedIndices.push(max);
  }
  const used = scores.filter((_, index) => !excludedIndices.includes(index));
  const divisor = BigInt(used.length);
  const sum = used.reduce((total, score) => total + score, 0n);
  // Exact decimal HALF_UP, before bonus addition, shared with the PDF calculation.
  const averageCents = ((sum * 2n + divisor * 10n) / (divisor * 20n)) * 10n;
  return { ...base, excludedIndices, usedCount: used.length, avg: Number(averageCents) / 100, final: Number(averageCents + bonusCents) / 100, unavailableReason: null };
}

export function rankResults(results, method = 'ALL') {
  const sorted = results.map(team => calculateResult(team, method)).sort((a, b) =>
    a.final == null ? (b.final == null ? 0 : 1) : b.final == null ? -1 : b.final - a.final);
  let previous = null;
  let rank = 0;
  return sorted.map((team, index) => {
    if (team.final == null) return team;
    if (team.final !== previous) rank = index + 1;
    previous = team.final;
    return { ...team, rank };
  });
}
