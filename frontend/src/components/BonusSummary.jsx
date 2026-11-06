import { bonusSummary } from '../utils/bonus';

export default function BonusSummary({ items = [] }) {
  const summary = bonusSummary(items);
  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm" aria-label="매니저 부여 가산점">
      <div className="flex justify-between gap-2 mb-2">
        <h3 className="font-semibold text-purple-900">가산점</h3>
        <span className="text-xs text-purple-600">매니저 부여 · 읽기 전용</span>
      </div>
      <dl className="max-h-44 overflow-y-auto space-y-2">
        {items.map((item) => (
          <div key={item.itemId} className="flex justify-between gap-3">
            <dt className="break-words min-w-0">{item.name}</dt>
            <dd className="shrink-0 text-purple-800">{item.score == null ? '—' : `${Number(item.score)}점`}{item.maxScore != null && ` / ${Number(item.maxScore)}점`}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 pt-2 border-t border-purple-200 flex justify-between gap-2">
        <span className="text-xs text-purple-600">{summary.completed}/{summary.count}개 입력</span>
        <strong>합계 {summary.total == null ? '—' : `${summary.total}점`}</strong>
      </div>
    </section>
  );
}
