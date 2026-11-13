import { Button } from './ui';
import { RESULT_METHODS } from '../utils/resultScoring';

export default function ProgramResultsExports({ method, pending, error, onExport }) {
  const options = [
    { title:'최종 결과 · 합격자만', desc:'PDF / Excel', color:'bg-green-50 text-green-600', format:'excel', passed:true, pdf:true, icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title:'전체팀 평가 정보', desc:'Excel', color:'bg-blue-50 text-blue-600', format:'excel', icon:'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { title:'팀 별 상세 정보', desc:'PDF · 심사위원 코멘트 포함', color:'bg-purple-50 text-purple-600', format:'pdf', icon:'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  ];
  return <section className="program-results-export bg-white rounded-xl border border-gray-200 p-5" aria-labelledby="results-export-title">
    <h3 id="results-export-title" className="text-sm font-semibold text-gray-700 mb-1">내보내기 옵션</h3>
    <p className="text-xs text-gray-500 mb-4">현재 기준: <strong>{RESULT_METHODS[method]}</strong><br/>선택한 방식의 전체 팀을 저장합니다.</p>
    {pending && <p role="status" className="text-xs text-blue-600 mb-3">파일을 준비하고 있습니다…</p>}
    {error && <p role="alert" className="text-xs text-red-600 mb-3">{error}</p>}
    <div className="space-y-2">{options.map(option => <div key={option.title} className="flex items-center rounded-lg border border-gray-100 hover:border-gray-200 group">
      <Button variant="ghost" onClick={()=>onExport(option.format,!!option.passed)} disabled={pending} className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 rounded-lg border-0 hover:bg-gray-50 text-left">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${option.color}`}><svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={option.icon}/></svg></span>
        <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-gray-800">{option.label || option.title}</span><span className="block text-xs text-gray-500">{option.desc}</span></span>
        <svg aria-hidden="true" className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      </Button>
      {option.pdf && <Button variant="ghost" onClick={()=>onExport('pdf',true)} disabled={pending} aria-label="최종 결과 · 합격자만 PDF로 내보내기" className="shrink-0 text-xs text-gray-500 hover:text-blue-600 px-2 mr-1">PDF</Button>}
    </div>)}</div>
  </section>;
}
