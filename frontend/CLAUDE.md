# CLAUDE.md

이 파일은 EvalHub 프론트엔드를 다룰 때의 가이드입니다.
인증·전화번호 규칙·공유 열거형 등 백엔드와 공유하는 규약은 저장소 루트의 `CLAUDE.md`에 있습니다.
코드를 수정하기 전에 먼저 이해한 바를 설명한 뒤, 대답을 듣고 코드 수정을 진행한다. 

## 명령어

```bash
npm run dev      # 개발 서버 실행 (포트 3000, /api/* → localhost:8080 프록시)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 실행
npm run preview  # 프로덕션 빌드 미리보기
```

테스트 스위트는 현재 설정되어 있지 않습니다.

## 기술 스택

React 19, React Router 7, TanStack Query 5, Axios 1, Tailwind CSS 4 (Vite 플러그인 방식), Vite 8.
PDF 뷰어는 `react-pdf`, 평가 결과 Excel 내보내기는 `exceljs`를 사용하며 둘 다 번들이 커서 필요한 시점에 lazy 로드합니다.

## 아키텍처

### 라우팅 (`src/App.jsx`)

역할별로 세 개의 레이아웃 트리가 있고, 각 트리는 `RequireAuth`로 보호됩니다.

| 경로 | 레이아웃 | 허용 역할 |
|---|---|---|
| `/login`, `/signup` | 없음 | 비로그인 |
| `/admin/*` | `AdminLayout` | `SUPER_ADMIN`, `MANAGER` |
| `/evaluator/*` | `EvaluatorLayout` | `EVALUATOR` |
| `/applicant/*` | `ApplicantLayout` | `MEMBER` |

그 외 경로는 `/login`으로 리다이렉트됩니다.

`components/RequireAuth.jsx`가 `GET /api/auth/me`로 로그인 여부를 확인하고, 역할이 맞지 않으면 해당 역할의 홈으로 돌려보냅니다.
**`localStorage`로 로그인 상태를 판단하지 않습니다.** 인증의 근거는 httpOnly 쿠키와 `/api/auth/me` 응답뿐이며, 프론트 코드에 `localStorage` 사용처는 없습니다 (루트 `CLAUDE.md`의 "인증" 참고).

주요 하위 경로:

- 관리자 — `programs`(목록·생성·수정·상세), `programs/:id/teams/:teamId`(팀 상세), `programs/:id/bonus/:teamId`(가산점), `teams`, `managers`, `evaluators`, `assignments`, `results`, `settings`
- 심사위원 — `/`(대시보드), `evaluate/:assignmentId/teams`(팀 목록), `evaluate/:assignmentId/teams/:teamId`(채점), `settings`
- 지원자 — `/`(홈), `apply/:applicationId`(지원서 작성), `submissions`, `submissions/:applicationId`, `team`(팀 정보), `settings`

### API 레이어 (`src/api/`)

모든 요청은 `client.js`의 단일 Axios 인스턴스(`baseURL: '/api'`)를 통해 전송합니다. 컴포넌트에 `localhost:8080` URL을 하드코딩하지 않습니다.

`client.js`는 세 가지를 전역으로 처리합니다.
- `withCredentials: true` — 인증 쿠키 자동 전송
- CSRF 토큰 자동 첨부 (`XSRF-TOKEN` 쿠키 → `X-XSRF-TOKEN` 헤더)
- 401 응답 시 쿼리 캐시를 비우고 `/login`으로 이동

| 파일 | 담당 |
|---|---|
| `auth.js` | 로그인/로그아웃, 현재 사용자, 비밀번호 변경 |
| `programs.js` | 프로그램·팀·양식 항목·평가 기준·배정·평가 결과 |
| `applications.js` | 회원가입, 지원서 작성·제출·취소, 팀 정보 수정 |
| `evaluations.js` | 심사위원 본인 배정 목록, 배정된 팀 목록, 평가 뷰 조회, 임시저장, 최종 제출 |
| `evaluators.js` | 심사위원 계정 목록/생성/삭제 |
| `managers.js` | 매니저 계정 목록/생성/삭제 (Super Admin) |
| `attachments.js` | PDF 업로드·삭제·조회 |

### 데이터 레이어 (`src/query/`)

서버 상태는 전부 TanStack Query가 관리합니다. 컴포넌트에서 `useEffect` + `useState`로 직접 fetch하지 마세요.

- `useApiQuery(queryKey, request, options)` — `useQuery` 래퍼. axios 응답에서 `data`를 꺼내줍니다
- `useLiveApiQuery(...)` — 위와 같지만 30초마다 자동 갱신 (백그라운드 탭에서는 멈춤). 여러 사용자가 동시에 보는 화면에 사용합니다
- `useCurrentUser()` — `GET /api/auth/me`. 로그인 사용자 조회의 단일 창구
- `queryKeys` (`keys.js`) — **쿼리 키는 반드시 여기에 정의합니다.** 문자열을 컴포넌트에 직접 쓰면 무효화가 어긋납니다
- `useRealtimeSync()` — `/api/events` SSE를 구독해 `change` 이벤트가 오면 활성 쿼리를 일괄 무효화합니다. `RequireAuth`에서 로그인 상태일 때만 켜집니다

### 페이지 구조 및 데이터 흐름

**관리자**
- `ProgramsPage` — 프로그램 목록. 생성·수정은 별도 화면(`CreateProgramPage`)으로 이동
- `ProgramDetailPage` — 탭 구성(지원 팀 / 배정 / 평가 결과). 탭 컴포넌트가 동일 파일 내 모듈 레벨에 정의됨
- `TeamDetailPage` — 팀 상세. 지원서 답변·첨부 확인, 합불 변경, 지원 정보 수정 모달 포함
- `TeamBonusPage` — 매니저 단독 가산점 부여
- `EvaluatorsPage` / `ManagersPage` — 계정 관리
- `AssignmentsPage` — 심사 배정 매트릭스
- `ResultsPage` — 프로그램을 골라 결과 화면으로 들어가는 목록 화면
- `components/ProgramResultsPanel` — 실제 결과 표와 Excel·인쇄 내보내기. `ProgramDetailPage`의 결과 탭에서 사용

**심사위원**
- `EvaluatorDashboardPage` — `getEvaluatorAssignments()`로 본인 배정 목록 조회. 서버가 인증 정보로 본인을 판별하므로 **프론트에서 이메일을 대조하지 않습니다**
- `EvaluationTeamsPage` — 배정된 프로그램의 팀 목록
- `EvaluationPage` — 팀별 채점. 좌측 탭(발표 자료 / 지원서 정보 / 팀 정보), 3초 후 자동 임시저장, 저장 안 된 변경이 있으면 이탈 경고

**지원자**
- `ApplicantHomePage` — 모집 중인 프로그램과 내 지원 현황
- `ApplicantFormPage` — 지원서 작성. 임시저장·제출
- `ApplicantSubmittedPage` — 제출한 지원서 열람
- `ApplicantTeamPage` — 제출 후 팀·본인 정보 수정

### React Router location state를 통한 상태 전달

심사위원 플로우는 전역 상태 없이 `navigate(..., { state: { ... } })`로 컨텍스트를 전달합니다:

- `EvaluatorDashboardPage` → `EvaluationTeamsPage`: `{ programId, programTitle }`
- `EvaluationTeamsPage` → `EvaluationPage`: `{ teams, programTitle, programId }` (전체 teams 배열로 이전/다음 팀 이동 구현)
- `ProgramsPage` → `ProgramDetailPage`: `{ defaultTab }`으로 특정 탭 바로 열기

### 공용 유틸 (`src/utils/`)

- `formFields.js` — 지원 양식 항목 유형(`TEXT`/`RADIO`/`CHECKBOX`)과 정규화. 체크박스 답변은 JSON 배열 문자열로 저장됩니다
- `phone.js` — 전화번호 정규화·표시. **백엔드 `PhoneNumbers.java`와 항상 함께 수정** (루트 `CLAUDE.md` 참고)
- `export.js` — 점수 계산(`teamAverage` = 심사위원 평균, `teamBonus`, `teamFinalScore` = 평균 + 가산점)과 순위 정렬, Excel·인쇄 내보내기. **점수 표시가 필요한 화면은 직접 계산하지 말고 여기서 가져다 씁니다**
- `applicant.js` — 날짜·D-day·파일 크기 표시 헬퍼
- `labels.js` — 프로그램 유형(`MODULE_A`/`MODULE_B`)의 한글 라벨

### 열거형 값

프론트와 백엔드가 같은 문자열을 씁니다. 전체 목록은 루트 `CLAUDE.md`의 "공유 열거형 값"에 있습니다.
자주 쓰는 것: 배정 상태 `ASSIGNED` → `IN_PROGRESS` → `SUBMITTED` (제출 후 배정 취소 불가), 팀 상태 `PENDING` | `PASSED` | `FAILED`.

## 디자인 레퍼런스

`docs/design/screen/`에 화면별 디자인 시안 이미지(PNG)가 있습니다.
새 페이지나 컴포넌트를 만들거나 UI를 수정할 때 해당 이미지를 먼저 확인하고,
레이아웃 배치, 색상, 간격, UI 요소 구성을 따릅니다.

- React 컴포넌트 + Tailwind CSS로 재구현합니다
- 시안에 없는 페이지는 기존 구현된 페이지의 스타일 패턴을 따릅니다
- 시안과 현재 구현이 다를 경우, 시안을 우선합니다

### 시안 파일 매핑

| 파일 | 역할 | 화면 |
|---|---|---|
| `01_login.png` | 공통 | 로그인 |
| `02_signup.png` | 공통 | 회원가입 |
| `03_admin_manager_list.png` | Super Admin | 매니저 관리 |
| `04_admin_manager_create.png` | Super Admin | 매니저 계정 생성 모달 |
| `05_mgr_programs.png` | Manager | 프로그램 목록 |
| `06_mgr_program_create.png` | Manager | 프로그램 생성 |
| `07_mgr_program_detail.png` | Manager | 프로그램 상세 (지원 팀 탭) |
| `08_mgr_team_detail.png` | Manager | 팀 상세 |
| `09_mgr_evaluators.png` | Manager | 심사위원 관리 |
| `10_mgr_evaluator_create.png` | Manager | 심사위원 계정 생성 모달 |
| `11_mgr_assignment_matrix.png` | Manager | 심사 배정 매트릭스 |
| `12_mgr_results.png` | Manager | 평가 결과·내보내기 |
| `13_eval_dashboard.png` | Evaluator | 내 평가 대시보드 |
| `14_eval_scoring_slides.png` | Evaluator | 평가 화면 (발표 자료 탭) |
| `15_eval_scoring_application.png` | Evaluator | 평가 화면 (지원서 정보 탭) |
| `16_eval_submitted.png` | Evaluator | 평가 완료·제출 상태 |
| `17_applicant_home.png` | Applicant | 지원자 홈 |
| `18_applicant_form.png` | Applicant | 지원서 작성 |
| `19_applicant_submitted.png` | Applicant | 제출 완료·내 지원서 보기 |
