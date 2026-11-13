import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server:{middlewareMode:true}, appType:'custom' });
try {
  const { default: ProgramDetail } = await server.ssrLoadModule('/src/pages/ProgramDetailPage.jsx');
  const { default: TeamDetail } = await server.ssrLoadModule('/src/pages/TeamDetailPage.jsx');
  const { queryKeys: keys } = await server.ssrLoadModule('/src/query/keys.js');
  const program = {id:1,title:'검증 프로그램',type:'MODULE_A',status:'ACTIVE',description:'개요에만 보여야 하는 설명',bonusEnabled:true,bonusItems:[{id:10,name:'지역 기업',maxScore:5},{id:11,name:'교육 이수',maxScore:5}]};
  const evaluation = (id,score,status='SUBMITTED') => ({evaluatorId:id,evaluatorName:`심사위원 ${id}`,submission:{status,totalScore:score,oneLineComment:status==='SUBMITTED'?'제출된 의견':'공개되면 안 되는 임시 의견',scores:[{criterionId:1,score}]}});
  const results = [{teamId:1,teamName:'A <팀>',teamStatus:'PENDING',bonusScore:2,bonusScores:[{itemId:10,name:'지역 기업',maxScore:5,score:0},{itemId:11,name:'교육 이수',maxScore:5,score:2}],evaluations:[evaluation(1,60),evaluation(2,80),evaluation(3,100),evaluation(4,90)]},{teamId:2,teamName:'미완료 팀',teamStatus:'PENDING',bonusScores:[{itemId:10,name:'지역 기업',maxScore:5,score:null}],evaluations:[evaluation(1,80),evaluation(2,999,'DRAFT')]}];
  const team={teamId:1,name:'A <팀>',status:'PENDING',members:[],bonusScores:results[0].bonusScores};
  let checks=0;
  function render(path='/admin/programs/1', options={}) {
    const client = new QueryClient({defaultOptions:{queries:{staleTime:Infinity,gcTime:Infinity,retry:false}}});
    for(const [key,data] of [[keys.programs,[options.program??program]],[keys.teams(1),[team]],[keys.criteria(1),[{id:1,name:'실현 가능성',maxScore:100}]],[keys.programEvaluators(1),[]],[keys.evaluationResults(1),options.results??results],[keys.team(1,1),team],[keys.teamApplication(1),null],[keys.teamAttachments(1),[]]])client.setQueryData(key,data);
    const route=options.legacyState?{pathname:path,state:options.legacyState}:path;
    const html=renderToStaticMarkup(h(QueryClientProvider,{client},h(MemoryRouter,{initialEntries:[route]},h(Routes,{},h(Route,{path:'/admin/programs/:programId',element:h(ProgramDetail)}),h(Route,{path:'/admin/programs/:programId/teams/:teamId',element:h(TeamDetail)})))));
    client.clear(); return html;
  }
  const check=(name,fn)=>{fn();checks++;console.log(`PASS ${name}`);};
  check('Overview is the default; program description is outside the shared header',()=>{
    const html=render();assert.match(html,/program-panel-overview/);assert.match(html,/개요에만 보여야 하는 설명/);assert.doesNotMatch(html.match(/<header[\s\S]*?<\/header>/)[0],/개요에만 보여야 하는 설명/);
  });
  check('Results compare item bonuses, preserve zero, and keep original export panel visible',()=>{
    const html=render('/admin/programs/1?tab=results');assert.match(html,/지역 기업/);assert.match(html,/교육 이수/);assert.match(html,/>0\.0<\/td>/);assert.match(html,/>84\.5<\/td>/);assert.match(html,/A &lt;팀&gt;/);assert.match(html,/내보내기 옵션/);assert.match(html,/총합 점수 분포/);assert.doesNotMatch(html,/<dialog|<details/);
  });
  check('Dialog shares trimmed score with table and displays criterion-level reasons',()=>{
    const html=render('/admin/programs/1?tab=results&resultMethod=TRIMMED&resultTeam=1');assert.match(html,/>87\.0<\/td>/);assert.match(html,/>87\.0<\/strong>/);assert.match(html,/기준별 점수/);assert.match(html,/제출된 의견/);assert.match(html,/평균 산출 제외/);
  });
  check('Unsubmitted evaluations never reveal draft scores or comments; verdict remains available',()=>{
    const html=render('/admin/programs/1?tab=results&resultTeam=2');assert.match(html,/심사 1명 미제출/);assert.match(html,/산출 불가 상태에서도 최종 판정은 저장할 수 있습니다/);assert.doesNotMatch(html,/999|공개되면 안 되는 임시 의견/);assert.match(html,/name="finalVerdict"/);
  });
  check('Legacy results entry survives the inserted overview tab',()=>assert.match(render('/admin/programs/1',{legacyState:{defaultTab:3}}),/program-panel-results/));
  check('No-bonus programs omit bonus columns while preserving average and total',()=>{
    const html=render('/admin/programs/1?tab=results',{program:{...program,bonusEnabled:false,bonusItems:[]},results:results.map(t=>({...t,bonusScore:null,bonusScores:[]}))});assert.doesNotMatch(html,/program-results-bonus-heading/);assert.match(html,/심사위원 평균/);assert.match(html,/총합/);
  });
  check('Team management uses complete-review scoring rather than a partial average',()=>{
    const html=render('/admin/programs/1/teams/1',{results:[{...results[0],evaluations:results[1].evaluations}]});assert.match(html,/최종 점수 산출 불가: /);assert.match(html,/최종 판정/);assert.doesNotMatch(html,/평가 전|공개되면 안 되는 임시 의견/);
  });
  console.log(`${checks} results workspace integration checks passed (SSR; interactions checked separately in browser).`);
} finally { await server.close(); }
