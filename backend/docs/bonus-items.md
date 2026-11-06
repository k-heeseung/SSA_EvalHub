# 여러 가산점 항목

프로그램 생성·수정 요청의 `bonusItems` 배열에 `{id, name, maxScore}`를 보냅니다.
신규 항목의 id는 null이며 기존 항목의 id는 유지합니다. 배열 순서가 표시 순서입니다.
`bonusEnabled=true`이면 항목을 최소 1개 등록해야 합니다. 신규 최대 점수는 필수입니다.
기존 클라이언트가 배열을 생략하면 기존 항목을 유지합니다.
최대 점수는 0~99999999.99, 소수 둘째 자리까지 허용합니다.
마이그레이션된 상한 없는 항목만 null 최대 점수를 유지할 수 있습니다.

`PATCH /api/programs/{programId}/teams/{teamId}/bonus`:

```json
{"scores":[{"itemId":1,"score":3},{"itemId":2,"score":0},{"itemId":3,"score":null}]}
```

모든 항목을 포함해야 하며, 중복 항목·다른 프로그램 항목·초과 점수는 전체 요청을 거부합니다.
사유 입력은 없으며 null은 미심사, 0은 심사 완료입니다.
응답의 `bonusScores`에는 itemId, name, maxScore, score가 포함됩니다.
`bonusScore`는 항목 점수 합계이며 모두 미심사이거나 가산점 사용이 꺼져 있으면 null입니다.
매니저 역할만 저장 가능하며, 심사위원은 본인 배정의 평가 조회·팀 목록 API로 조회합니다.

프로그램의 `evaluationStarted`는 최초 성공한 임시저장 또는 최종 제출 시 true가 됩니다.
단순 조회는 시작으로 간주하지 않습니다. 시작 후에는 항목 삭제·최대 점수 축소·사용 해제를
409로 차단합니다. 시작 전에도 이미 부여한 점수보다 최대 점수를 낮출 수 없습니다.
프로그램 설정·팀 가산점·심사위원 저장은 같은 프로그램 행의 쓰기 잠금으로 동시 변경을 직렬화합니다.

Flyway V20은 기존 단일 가산점을 항목 1개로 이전합니다. 기존 미입력·0점·상한 없음·사유를 보존하며,
기존 심사 기록이 있으면 evaluationStarted를 true로 설정합니다. 기존 사유는 화면/API에서 제외합니다.
최종 점수는 제출된 심사위원 점수 평균 + 항목 가산점 합계이며, 심사위원 개인 점수는 유지합니다.

## 검증

- MultipleBonusIntegrationTests: 생성/항목 ID 유지, 저장/조회, 범위/중복/누락 검증,
  조회만 한 경우 수정 허용, 임시저장/직접 제출 이후 수정 제한, 권한, 합계
- BonusMigrationTests: V19 → V20 이전 시 기존 점수/0점/미입력/상한 없음/사유/심사 시작 여부 보존
- frontend/tests/bonus.test.mjs: 미심사·0점, 합계, 소수 및 범위
- frontend/tests/bonusExport.test.mjs: 평균+가산점, 실제 Excel 파일 열/값, 인쇄 내용 및 HTML 이스케이프

검증용 PostgreSQL 스키마는 `bonus_verify_20261105`로 분리했습니다.

## 전체 회귀 테스트에서 확인한 기존 불일치

2026-11-05 전체 백엔드 155개 중 153개 통과. 아래 2개는 가산점 변경 전부터 존재하던
일정 정책과 테스트 기대값의 불일치이며 해당 동작은 변경하지 않았습니다.

- ApplicationEvaluationVisibilityIntegrationTests.evaluatorSeesOnlyEvaluableTeamsAndCountsAllApplicationMembers:
  평가 시작일이 오늘보다 11일 뒤인 프로그램에서 임시저장 성공을 기대합니다. 현재 정책은 시작 전 저장 차단입니다.
- ApplicationEvaluationVisibilityIntegrationTests.assigningEvaluatorReopensCompletedProgram:
  완료된 프로그램에 심사위원을 추가하면 ACTIVE 전환을 기대합니다. 현재 정책은 자동 재개하지 않고 평가 마감일 연장 시 재개입니다.

프론트엔드 테스트 41개와 변경 파일 ESLint 및 프로덕션 빌드는 통과했습니다.

최종 가산점 통합 13개 + 마이그레이션 1개, 총 14개 테스트 통과.
심사 시작 전 점수가 있는 항목 삭제와 다른 팀·심사위원의 최초 임시저장에 따른 잠금도 포함합니다.

프로그램 편집에서 가산점 항목은 왼쪽 핸들로 순서를 변경하고 회색 × 버튼으로 제거합니다.
추가 버튼은 평가 항목과 동일한 디자인입니다. 항목별 최대 점수 입력은 유지하고 최대 가산점 합계 표시만 제거합니다.
순서 변경 시 항목 ID를 유지하여 기존 팀별 점수를 보존합니다.
