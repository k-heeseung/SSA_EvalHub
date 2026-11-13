export default function ApplicantQueryNotice({ query, label, detail }) {
  if (!query.isPending && !query.isError) return null;
  return (
    <div role={query.isError ? 'alert' : 'status'}
      className={`mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${query.isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'}`}>
      <p>{query.isError ? `${label} 조회에 실패했습니다. ${detail}` : `${label} 조회 중입니다.`}</p>
      {query.isError && (
        <button type="button" onClick={() => { void query.refetch(); }} disabled={query.isFetching}
          className="ui-button ui-button--secondary" aria-busy={query.isFetching}>
          {label} {query.isFetching ? '재시도 중...' : '다시 시도'}
        </button>
      )}
    </div>
  );
}
