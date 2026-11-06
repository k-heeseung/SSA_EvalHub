import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { teamBonus, teamFinalScore, exportAllTeamsExcel, exportFinalExcel } from '../src/utils/export.js';

const result = {
  teamId: 1, teamName: '<A팀>', teamStatus: 'PASSED', bonusScore: 5,
  bonusScores: [
    { itemId: 10, name: '지역 기업', score: 3, maxScore: 3 },
    { itemId: 11, name: '교육 <수료>', score: 2, maxScore: 2 },
    { itemId: 12, name: '특허', score: null, maxScore: 5 },
  ],
  evaluations: [
    { evaluatorId: 1, evaluatorName: '심사 1', submission: { status: 'SUBMITTED', totalScore: 80 } },
    { evaluatorId: 2, evaluatorName: '심사 2', submission: { status: 'SUBMITTED', totalScore: 90 } },
    { evaluatorId: 3, evaluatorName: '심사 3', submission: { status: 'DRAFT', totalScore: 10 } },
  ],
};
test('final score adds the item total once to submitted evaluator average', () => {
  assert.equal(teamBonus(result), 5);
  assert.equal(teamFinalScore(result), 90);
  assert.equal(teamFinalScore({ ...result, evaluations: [], bonusScore: null, bonusScores: [{ score: null }] }), null);
  assert.equal(teamFinalScore({ ...result, evaluations: [], bonusScore: null, bonusScores: [{ score: 0 }] }), 0);
});
test('Excel files contain every bonus item, blank missing scores, and the correct total', async () => {
  const blobs = [];
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:bonus-test'; };
  URL.revokeObjectURL = () => {};
  try {
    await exportAllTeamsExcel('프로그램', [result]);
    await exportFinalExcel('프로그램', [result]);
    for (const blob of blobs) {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await blob.arrayBuffer());
      const sheet = book.worksheets[0];
      const header = sheet.getRow(1).values;
      const row = sheet.getRow(2);
      for (const [name, value] of [['가산점: 지역 기업', 3], ['가산점: 교육 <수료>', 2], ['가산점: 특허', ''], ['가산점 합계', 5]]) {
        assert.equal(row.getCell(header.indexOf(name)).value, value);
      }
      const scoreColumn = header.indexOf('총합') > 0 ? header.indexOf('총합') : header.indexOf('최종 점수');
      assert.equal(row.getCell(scoreColumn).value, 90);
    }
  } finally {
    globalThis.document = previousDocument;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});
