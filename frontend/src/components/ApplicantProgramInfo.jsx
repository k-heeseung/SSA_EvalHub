export default function ApplicantProgramInfo({ program }) {
  const description = program.description?.trim();
  const eligibility = program.eligibilityCriteria?.trim();

  return (
    <div className="ui-card min-w-0 space-y-8">
      <section aria-labelledby="program-introduction">
        <h2 id="program-introduction" className="mb-4 text-xl font-semibold text-gray-900">프로그램 소개</h2>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
          {description || '등록된 프로그램 설명이 없습니다.'}
        </p>
      </section>
      <section aria-labelledby="program-eligibility" className="border-t border-gray-200 pt-6">
        <h2 id="program-eligibility" className="mb-4 text-xl font-semibold text-gray-900">지원 자격</h2>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
          {eligibility || '등록된 지원 자격 안내가 없습니다.'}
        </p>
      </section>
    </div>
  );
}
