export function validCriterionMaxScore(value) {
  return /^\d+(\.\d{1,2})?$/.test(String(value))
    && Number(value) > 0 && Number(value) <= 999999.99;
}

export function totalCriterionMaxScore(items) {
  return items.reduce((cents, item) => {
    const value = Number(item.maxScore);
    return cents + (Number.isFinite(value) ? Math.round(value * 100) : 0);
  }, 0) / 100;
}
