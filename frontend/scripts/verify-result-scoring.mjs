import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { validBonusScore } from '../src/utils/bonus.js';
import { validCriterionMaxScore } from '../src/utils/criteria.js';
assert(validBonusScore('1.1', 2));
assert(!validBonusScore('1.01', 2));
assert(validCriterionMaxScore('40.2'));
assert(!validCriterionMaxScore('40.25'));
import { calculateResult, rankResults } from '../src/utils/resultScoring.js';
import { exportAllTeamsExcel, exportFinalExcel } from '../src/utils/export.js';
const team = (scores, bonus = 0, id = 1) => ({teamId:id,teamName:`팀${id}`,teamStatus:'PASSED',bonusScore:bonus,evaluations:scores.map((score,i)=>({evaluatorId:i+1,evaluatorName:`심사${i+1}`,submission:score==null?null:{status:'SUBMITTED',totalScore:score}}))});
assert.equal(calculateResult(team([60,80,85,90,100],5),'ALL').final,88);
assert.equal(calculateResult(team([60,80,85,90,100],5),'TRIMMED').final,90);
assert.equal(calculateResult(team([70,80,100],6),'TRIMMED').final,86);
const same=calculateResult(team([90,90,90,90]),'TRIMMED');
assert.deepEqual(same.excludedIndices,[0,1]);assert.equal(same.usedCount,2);assert.equal(same.avg,90);
for (const method of ['ALL','TRIMMED']) {
 assert.equal(calculateResult(team([90,null,80],99),method).final,null);
 assert.equal(calculateResult(team([],99),method).rank,null);
}
assert.equal(calculateResult(team([85,95]),'TRIMMED').final,null);
assert.equal(calculateResult(team([85,95]),'ALL').avg,90);
assert.equal(calculateResult(team([1,1.1]),'ALL').avg,1.1,'exact HALF_UP at .05');
assert.equal(calculateResult(team([0.01,0.01,0.02]),'ALL').avg,0);
assert.equal(calculateResult(team([70,78,86,92,99],4),'TRIMMED').final,89.3);
assert.equal(calculateResult(team([null,null],40),'ALL').final,null,'bonus alone never creates a total');
const ranked=rankResults([team([90],0,1),team([90],0,2),team([80],0,3),team([null],100,4)]);
assert.deepEqual(ranked.map(t=>t.rank),[1,1,3,null]);
assert.equal(calculateResult(team([null]),'ALL').unavailableReason,'심사 1명 미제출');
assert.equal(calculateResult(team([1,1.1],0.1),'ALL').final,1.2);
const files=[];const anchors=[];
globalThis.document={createElement:()=>{const a={click(){},remove(){}};anchors.push(a);return a;},body:{appendChild(){}}};
URL.createObjectURL=blob=>{files.push(blob);return 'blob:test';};URL.revokeObjectURL=()=>{};
const data=[team([60,80,85,90,100],5,1),team([90,88,null],9,2)];
for(const method of ['ALL','TRIMMED']) {
 await exportAllTeamsExcel('검증',data,method);
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await files.at(-1).arrayBuffer());
 const ws=wb.worksheets[0],header=ws.getRow(1).values;
 assert.equal(ws.getRow(2).getCell(header.indexOf('산출 방식')).value,method==='ALL'?'전체 평균':'최고·최저 제외 평균');
 assert.equal(ws.getRow(2).getCell(header.indexOf('총합')).value,method==='ALL'?88:90);
 assert.equal(ws.getRow(3).getCell(header.indexOf('총합')).value,'');
 assert.equal(ws.getRow(3).getCell(header.indexOf('산출 불가 사유')).value,'심사 1명 미제출');
 assert.equal(ws.rowCount,3);
}
await exportFinalExcel('검증',data,'TRIMMED');
assert.match(anchors.at(-1).download,/최고·최저 제외 평균/);
console.log('PASS result methods, ties, incomplete/insufficient, exact rounding, and actual Excel workbook contents');
