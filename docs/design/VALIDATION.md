# 공통 디자인 적용 검증

기준: 승인된 매니저 프로그램 목록. Noto Sans KR, 제목 자간 +0.015em, 공통 색상·테두리·버튼·입력·여백 규칙.

## 화면 범위

실제 컴포넌트를 사용하는 격리된 예시 데이터에서 25개 화면 상태를 1280px 데스크톱과 390px 모바일로 검증했다. 데이터의 상태와 내용은 동일하며 역할에 맞는 레이아웃을 사용한다. 각 상태에서 렌더 오류, 미정의 예시 API 응답, 문서/본문 가로 넘침을 검사했다. 표와 상태 탭의 의도된 내부 가로 스크롤은 허용한다.

| 화면 | 데스크톱 | 모바일 |
|---|---|---|
| admin-assignments | 통과 | 통과 |
| admin-bonus | 통과 | 통과 |
| admin-create | 통과 | 통과 |
| admin-detail | 통과 | 통과 |
| admin-edit | 통과 | 통과 |
| admin-evaluators | 통과 | 통과 |
| admin-managers | 통과 | 통과 |
| admin-programs | 통과 | 통과 |
| admin-results | 통과 | 통과 |
| admin-results-detail | 통과 | 통과 |
| admin-settings | 통과 | 통과 |
| admin-teamdetail | 통과 | 통과 |
| admin-teams | 통과 | 통과 |
| applicant-form | 통과 | 통과 |
| applicant-home | 통과 | 통과 |
| applicant-settings | 통과 | 통과 |
| applicant-submissions | 통과 | 통과 |
| applicant-submitted | 통과 | 통과 |
| applicant-team | 통과 | 통과 |
| evaluator-dashboard | 통과 | 통과 |
| evaluator-evaluation | 통과 | 통과 |
| evaluator-settings | 통과 | 통과 |
| evaluator-teams | 통과 | 통과 |
| login | 통과 | 통과 |
| signup | 통과 | 통과 |

## 주요 동작

다음 10개 동작은 실제 페이지·핸들러를 사용하되 네트워크 전송 없는 메모리 adapter에서 검증했다. UI 회귀 검증이며 서버 데이터 저장·권한·메일 통합 검증을 대신하지 않는다.

- evaluation draft and submit
- application draft
- application submit
- missing required field blocks submission
- assignment confirm
- program filter
- delete dialog Escape cancellation
- mobile manager navigation
- time picker and switch
- Excel export

평가 임시저장/제출, 지원서 임시저장/제출과 완료 화면, 필수 입력 누락 차단, 심사 배정 확정, 프로그램 필터, 삭제 취소/포커스 복귀, 모바일 메뉴, 시간 선택/스위치, Excel 파일 생성이 포함된다. Excel 다운로드는 6,985바이트의 ZIP/XLSX 파일로 확인했다.

## 실제 계정 검증

- 매니저: 프로그램·팀·심사위원·배정 목록 및 생성 양식 진입.
- 심사위원: 제공된 계정으로 로그인, 배정 팀/자료 탭/기간별 읽기 전용, 실제 PDF canvas 표시, 확대 100→120%, 폭 맞춤 100% 복귀.
- 지원자: 제공된 계정으로 로그인, 지원 가능 목록, 제출 내역, 수정 양식 진입, 모바일 메뉴/양식.
- 실제 계정의 저장·제출·삭제·계정 변경·메일 발송은 실행하지 않았다. 저장/제출 동작은 격리 예시 환경에서 검증했다.

## 공통 검사

- npm run lint: 통과
- npm run verify:ui: 9개 SSR 의미 검사 통과 (명시적 submit/disabled/ARIA/선택/필드 이름/문구 이스케이프 등)
- npm run build: 통과; 기존 큰 JavaScript 청크 경고는 남아 있다.
- Impeccable type/layout 전체 src 스캔: 각각 0건
- git diff --check: 통과
- API/query/backend 파일 변경 없음. 페이지 AST 비교로 표시 속성을 제외한 기존 핸들러·데이터 처리 보존 확인.

## 산출물

- DESIGN.md / .impeccable/design.json: 공통 시각 기준
- frontend/src/styles/ui.css: 토큰·공통 스타일
- frontend/src/components/ui.jsx 및 UI.md: 공통 기본 요소와 사용 계약
- frontend/.impeccable/validation.html: 프로덕션에 포함되지 않는 검증 전용 진입점
- .impeccable/global-validation/results.json: 상태별 기계 판정과 동작 기록
- 같은 폴더의 화면별 PNG: 검증 캡처

첨부 업로드·서버 PDF 내보내기·실제 저장/제출의 백엔드 통합은 이번 UI 변경 검증 범위에 포함되지 않는다. 실제 PDF 열람과 클라이언트 Excel 내보내기는 별도 확인했다.
