export function bonusSummary(items = []) {
  const scored = items.filter((item) => item.score != null);
  return {
    total: scored.length ? Math.round(scored.reduce((sum, item) => sum + Number(item.score), 0) * 100) / 100 : null,
    completed: scored.length,
    count: items.length,
  };
}

export function validBonusScore(value, max) {
  if (value === '') return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 99999999.99
    && Math.abs(n * 100 - Math.round(n * 100)) < 0.000001
    && (max == null || n <= Number(max));
}
