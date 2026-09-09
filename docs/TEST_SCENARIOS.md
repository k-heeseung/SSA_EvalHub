# EvalHub 전체 테스트 시나리오

역할별 사용 흐름 + 수동 검증 체크리스트. 실제 코드(라우팅·권한·상태 전이·검증 규칙)를 근거로 작성했습니다.
`[ ]` 를 채우며 검증하세요. **기대 결과**가 다르면 버그 후보입니다.

> 권장 순서: **0 사전준비 → 1 인증 → 3 매니저(프로그램 개설·양식·기준·배정) → 5 지원자(지원·제출) → 4 심사위원(평가·제출) → 3.6~3.9 매니저(가산점·판정·결과·내보내기) → 6~9 엣지/실시간/내보내기 검증**
> 데이터가 서로 물려 있어 이 순서로 해야 한 프로그램을 처음부터 끝까지 관통할 수 있습니다.

---

## 0. 사전 준비

### 0.1 실행
- [ ] PostgreSQL: `cd backend && docker-compose up -d`
- [ ] 백엔드 재시작: `cd backend && ./gradlew bootRun` — *최근 변경(evaluatorName 응답 추가) 반영을 위해 반드시 재시작*
- [ ] 프론트: `cd frontend && npm run dev`
- [ ] 브라우저 **하드 리프레시**(Ctrl+Shift+R) — 로고/의존성(exceljs) 변경 반영

### 0.2 초기 최고관리자(SUPER_ADMIN) 만들기
자동 생성 계정은 **환경변수를 줘야만** 만들어집니다(`AdminBootstrapRunner`).
- [ ] 백엔드 실행 전 `EVALHUB_BOOTSTRAP_ADMIN_EMAIL`, `EVALHUB_BOOTSTRAP_ADMIN_PASSWORD` 설정 → 부팅 시 SUPER_ADMIN 1명 생성
  - 예) PowerShell: `$env:EVALHUB_BOOTSTRAP_ADMIN_EMAIL="admin@skku.edu"; $env:EVALHUB_BOOTSTRAP_ADMIN_PASSWORD="..." ; ./gradlew bootRun`
- [ ] 이미 같은 이메일이 있으면 재생성하지 않음(정상)

### 0.3 테스트 계정 준비(위 관리자 로그인 후 생성)
| 역할 | 만드는 방법 | 로그인 화면 역할 선택 |
|---|---|---|
| SUPER_ADMIN | 부트스트랩(0.2) | 관리자 |
| MANAGER | 관리자 → 매니저 관리에서 생성 (`POST /api/users`) | 관리자 |
| EVALUATOR | 관리자/매니저 → 심사위원 관리에서 생성 | 심사위원 |
| MEMBER(지원자) | 로그인 화면의 **회원가입**(`/signup`) 또는 관리자가 생성 | 지원자 |

> 로그인은 **이메일 + 비밀번호 + 역할 선택 3개가 모두 맞아야** 성공합니다. 단, SUPER_ADMIN 계정은 "관리자(MANAGER)" 선택으로도 로그인됩니다.

---

## 1. 인증 · 권한 (전 역할 공통)

### 1.1 로그인/로그아웃
- [ ] 올바른 이메일·비밀번호·역할 → 로그인 성공, 역할별 홈으로 이동
  - SUPER_ADMIN/MANAGER → `/admin/dashboard`, EVALUATOR → `/evaluator`, MEMBER → `/applicant`
- [ ] 비밀번호 틀림 → 401, "아이디, 비밀번호 또는 역할이 올바르지 않습니다."
- [ ] **역할 불일치**(예: 심사위원 계정으로 "관리자" 선택) → 401 (같은 메시지)
- [ ] SUPER_ADMIN 계정으로 "관리자" 선택 로그인 → 성공 (호환 허용)
- [ ] "로그인 상태 유지(remember me)" 체크 → 30일, 미체크 → 30분 만료 (쿠키 maxAge로 확인)
- [ ] 로그아웃 → 세션/쿼리 캐시 초기화, `/login`으로 이동

### 1.2 라우팅 가드 (URL 직접 접근)
- [ ] 비로그인 상태로 `/admin/*`, `/evaluator/*`, `/applicant/*` 접근 → `/login`으로 리다이렉트
- [ ] EVALUATOR 로그인 후 `/admin/programs` 직접 접근 → 자기 홈(`/evaluator`)으로 리다이렉트
- [ ] MEMBER 로그인 후 `/admin` 또는 `/evaluator` 접근 → `/applicant`로 리다이렉트
- [ ] MANAGER 로그인 후 `/admin/managers` 접근 시 매니저 목록 API는 **SUPER_ADMIN 전용**(`GET /api/managers` → 403). 화면 동작 확인
- [ ] 존재하지 않는 경로(`/aaa`) → `/login`

### 1.3 세션 유효성
- [ ] 로그인 상태에서 새로고침 → 로그인 유지(`/api/auth/me`)
- [ ] 로그인 중 해당 계정을 다른 관리자가 삭제 → 이후 요청에서 세션 무효화되어 로그아웃되는지(`SessionAccountValidationFilter`)

### 1.4 비밀번호 변경 (내 계정 설정) — 전 역할 공통
> 우상단 사용자 메뉴 → **설정** → 내 계정 설정 페이지 (`/admin/settings`, `/evaluator/settings`, `/applicant/settings`). 백엔드는 공용 `PUT /api/auth/password`.
- [ ] 매니저·심사위원·지원자 각 역할에서 설정 진입, 이메일·역할이 읽기전용으로 표시
- [ ] 올바른 현재 비밀번호 + 새 비밀번호(8자↑) + 확인 일치 → "비밀번호가 변경되었습니다."
- [ ] 변경 후 **로그아웃 → 새 비밀번호로 로그인** 성공, 기존 비밀번호로는 실패
- [ ] 현재 비밀번호 틀림 → 400 "현재 비밀번호가 올바르지 않습니다."
- [ ] 새 비밀번호 8자 미만 → 400 / 클라이언트 선검증 메시지
- [ ] 새 비밀번호 ≠ 확인 → "새 비밀번호가 일치하지 않습니다."
- [ ] 새 비밀번호 = 현재 비밀번호 → "새 비밀번호가 기존 비밀번호와 동일합니다."
- [ ] 비로그인 상태로 `PUT /api/auth/password` 직접 호출 → 401

---

## 2. SUPER_ADMIN (최고 관리자)

MANAGER의 모든 기능 + 아래 전용 기능.

- [ ] **매니저 관리** 메뉴 진입 (`/admin/managers`) — MANAGER 계정에는 이 목록이 안 보이거나 403
- [ ] 매니저 계정 **생성**: 이메일/비번/이름 → 목록에 추가
- [ ] 중복 이메일로 매니저 생성 → 409 "Email already exists."
- [ ] 이메일/비번/역할 누락 생성 → 400
- [ ] 계정 **삭제** (`DELETE /api/users/{id}`) → 목록에서 사라짐, 해당 계정 로그인 불가

---

## 3. MANAGER (운영 매니저)

### 3.1 프로그램 생명주기
- [ ] 프로그램 목록(`/admin/programs`) 진입, "프로그램 생성"
- [ ] MODULE_A / MODULE_B 유형 선택하여 생성
- [ ] 날짜 규칙 위반 시 400:
  - [ ] 지원 시작 > 지원 마감 → "Application start must not be after its deadline."
  - [ ] 평가 시작 < 지원 마감 → "Evaluation start must not be before the application deadline."
  - [ ] 평가 마감 < 평가 시작 → "Evaluation deadline must not be before its start."
- [ ] 생성 직후 상태 = **DRAFT**(기본). 지원자에게 노출 안 됨
- [ ] 상태를 **RECRUITING(접수중)** 으로 바꾸면 지원자 홈(`/api/programs/open`)에 노출
- [ ] 프로그램 **수정**(PATCH): 보낸 필드만 변경, null 필드는 유지
- [ ] 프로그램 **삭제**: 하위 팀/질문/배정까지 함께 삭제되는지
- [ ] 상태 수동 전환 ACTIVE ↔ INACTIVE 동작

### 3.2 지원 양식 항목 (form-fields)
- [ ] 프로그램 상세 → 지원 양식 편집, 항목 추가(텍스트/선택 등), 순서 지정
- [ ] 저장(PUT은 **전체 교체**) 후 다시 조회 시 순서·내용 일치
- [ ] 양식 조회는 비로그인/지원자도 가능(`GET /form-fields` permitAll) — 지원 화면에서 렌더 확인

### 3.3 평가 기준 (criteria)
- [ ] 평가 질문 추가 (0~10점 척도), `displayOrder`대로 정렬
- [ ] 질문 수정/삭제
- [ ] 다른 프로그램의 criterion을 이 프로그램 경로로 수정 시도 → 400 "Criterion does not belong to this program."

### 3.4 팀 / 평가 대상 관리
- [ ] 매니저가 직접 팀 등록(`POST /programs/{id}/teams`) — TEAM 유형
- [ ] 개인 참가자 등록 — `participantType=INDIVIDUAL` 1인 팀
- [ ] 팀원 추가(`POST /teams/{id}/members`) — 존재하는 이메일이어야, 없으면 404
- [ ] 같은 팀에 같은 팀원 중복 추가 → 409 "Member already in team."
- [ ] 팀 정보 수정(이름/설명/제출 URL/비고), 팀 삭제(첨부·배정 함께 삭제)
- [ ] **지원서로 생성된 팀 중 아직 DRAFT(미제출)인 팀은 매니저 팀 목록에 안 보임** (제출된 팀만 노출)

### 3.5 심사위원 관리 & 배정
- [ ] 심사위원 목록(`/admin/evaluators`), 심사위원 계정 생성
- [ ] 심사위원 활성/비활성 전환(`PATCH /evaluators/{id}/status`)
- [ ] 배정 화면(`/admin/assignments`)에서 프로그램에 심사위원 배정(`POST /programs/{id}/assignments`)
  - [ ] 배정은 **(프로그램, 심사위원) 단위** — 심사위원 1명이 그 프로그램의 평가 대상 팀 전체를 평가
- [ ] EVALUATOR가 아닌 계정을 배정 → 400 "User is not an evaluator."
- [ ] 같은 프로그램에 같은 심사위원 중복 배정 → 409 "Assignment already exists."
- [ ] 배정 취소(`DELETE /assignments/{id}`) — 제출 전이면 성공
- [ ] **이미 제출(SUBMITTED)된 배정** 취소 시도 → 400 "Cannot cancel a submitted assignment."

### 3.6 가산점 (bonus)
> 프로그램 설정에서 **가산점 활성화 + 최대 가산점**이 켜져 있어야 함.
- [ ] 팀 가산점 입력(`PATCH /programs/{id}/teams/{teamId}/bonus`) 정상 저장
- [ ] 가산점 비활성 프로그램에서 입력 → 400 "Bonus is not enabled for this program."
- [ ] 음수 입력 → 400 "Bonus score must be non-negative."
- [ ] 최대치 초과 입력 → 400 "Bonus score exceeds the program maximum."

### 3.7 팀 합격/불합격 판정
- [ ] 팀 상태 변경(`PATCH .../status`) PENDING → PASSED / FAILED
- [ ] 결과 화면·목록의 판정 배지가 즉시 반영되는지

### 3.8 결과 · 내보내기 (`/admin/results` 및 프로그램 상세 "평가 결과" 탭)
- [ ] 팀별 심사위원 점수/평균/(가산점·총합)/판정 표가 정확한지
  - **심사위원 총점** = 그 심사위원이 매긴 항목 점수들의 **합계**
  - **평균** = 심사위원 총점들의 평균 / **총합** = 평균 + 가산점
- [ ] 필터(전체/합격/불합격/미정), 순위 정렬(총합 내림차순), 점수 분포 차트 확인
- [ ] 내보내기 검증은 **9장** 참고 (엑셀/PDF)

### 3.9 첨부파일(PDF)
- [ ] 팀 상세에서 PDF 업로드(`POST /teams/{id}/attachments`) — `application/pdf`만
- [ ] PDF 아닌 파일 업로드 → 400 "Only PDF files can be uploaded."
- [ ] 빈 파일 → 400 "PDF file is empty."
- [ ] 20MB 초과 파일 / 요청 25MB 초과 → 413 등 업로드 거부
- [ ] 업로드한 PDF를 뷰어에서 열람(`GET /attachments/{id}/content`, inline)
- [ ] 첨부 삭제

---

## 4. EVALUATOR (심사위원)

### 4.1 대시보드 & 팀 목록
- [ ] 로그인 후 `/evaluator` — 배정된 프로그램별 팀 수/제출·임시저장 집계 표시
- [ ] 배정 카드 클릭 → 팀 목록(`/evaluate/{assignmentId}/teams`), 팀별 본인 채점 상태(미평가/임시저장/제출)
- [ ] **평가 대상 팀 규칙**: 지원서로 생성된 팀은 **지원서가 최종 제출된 경우에만** 목록에 노출. 매니저가 직접 만든 팀은 항상 노출

### 4.2 평가 화면
- [ ] 팀 진입(`/evaluate/{assignmentId}/teams/{teamId}`) — 프로그램/팀/질문/첨부 PDF/기존 저장분 로드
- [ ] 첨부 PDF 뷰어 열람
- [ ] 다른 심사위원의 배정 ID로 접근 시도(URL 조작) → 403 "Assignment does not belong to this evaluator."
- [ ] 그 프로그램 소속이 아닌 teamId 접근 → 400 "Team does not belong to this assignment."
- [ ] 미제출(평가 불가) 지원팀 접근 → 404 "Team is not available for evaluation."

### 4.3 임시저장 (draft)
- [ ] 일부 항목만 채점 → 임시저장 성공
- [ ] 한줄평 입력, 재진입 시 값 유지

### 4.4 최종 제출 (submit)
- [ ] 모든 항목 채점 후 제출 → 성공, 상태 SUBMITTED
- [ ] **일부 항목 미채점 상태로 제출** → 400 "All criteria must be scored before submission."
- [ ] 0~10 범위 벗어난 점수(예: 11, -1) → 400 "Score must be between 0 and 10."
- [ ] 다른 프로그램의 criterionId 섞어 보냄 → 400 "Criterion does not belong to this program."
- [ ] 한줄평 500자 초과 또는 줄바꿈 포함 → 400 "One-line comment must be 500 characters or less..."
- [ ] 제출 후 매니저 결과 화면/배정 현황에 반영
- [ ] **평가 마감일 경과 후 제출** → 400 "평가 마감일이 지나 제출할 수 없습니다."
  - [ ] 단, **임시저장은 마감 후에도 허용**되는지 (제출만 차단)
  - [ ] 평가 마감일이 **없는** 프로그램은 마감 제한 없이 제출 가능

---

## 5. MEMBER (지원자)

### 5.1 회원가입 · 홈
- [ ] `/signup`에서 지원자 가입(MEMBER) → 성공
- [ ] 중복 이메일 가입 → 409 "Email already exists."
- [ ] 이메일/비번 누락 → 400
- [ ] 로그인 후 `/applicant` 홈:
  - **지원 가능한 프로그램**: RECRUITING만, 마감일 지난 건 제외
  - **접수 예정**: SCHEDULED 프로그램이 별도 섹션에 "시작 D-n" 배지 + **지원 버튼 비활성**으로 노출
  - [ ] 접수 예정 프로그램은 지원 불가(버튼 비활성). 시작일이 되어 RECRUITING이 되면 "지원 가능" 섹션으로 이동

### 5.2 지원서 작성
- [ ] 프로그램 "지원하기" → 초안 생성(`POST /programs/{id}/applications`) — 이때 **제출 대상 팀이 함께 생성**되어 PDF 첨부 가능
- [ ] 이미 지원서가 있으면 기존 지원서로 이동(중복 생성 안 함)
- [ ] **RECRUITING 아님/DRAFT/ACTIVE** 프로그램에 지원 시작 → 400 "현재 지원을 접수하지 않는 프로그램입니다."
- [ ] **지원 마감일 경과** 후 지원 시작 → 400 "지원 기간이 마감되었습니다."
- [ ] 양식 항목 입력, 팀명/본인 정보 입력
- [ ] PDF 첨부 업로드/삭제 (자기 팀 것만 가능)

### 5.3 임시저장 · 제출 · 수정 · 취소
- [ ] 임시저장(`PUT .../draft`) 후 목록에서 상태 DRAFT
- [ ] 필수 항목/필수 첨부 누락 상태로 제출 → 400 (검증 메시지)
- [ ] 모두 채우고 제출(`PUT .../submit`) → SUBMITTED, "제출 완료" 화면
- [ ] **제출 후 다시 draft API로 저장하면 상태가 초안으로 되돌아감** (정책 확인)
- [ ] 팀 정보만 수정(`PUT .../team-info`) — 제출 상태 유지한 채 팀명/팀원/연락처 변경
  - [ ] 개인(INDIVIDUAL) 참가자 정보 검증: participantName 누락 → 400
  - [ ] 팀(TEAM) 유형인데 팀명 누락 → 400 "팀 이름을 입력해주세요."
- [ ] 지원 취소(`DELETE /applications/{id}`) → 지원서 + 팀 + 첨부 삭제
- [ ] 남의 지원서 ID 접근(URL 조작) → 403 "Application does not belong to this user."

### 5.4 제출 → 평가 대상 편입 확인 (교차)
- [ ] 지원서 **제출 전**: 매니저 팀 목록에 안 보이고, 심사위원 평가 대상에도 안 뜸
- [ ] 지원서 **제출 후**: 매니저 팀 목록에 노출 + 심사위원 평가 대상에 노출

---

## 6. 상태 자동 전환 · 시간 규칙

자동 전환 대상 = **SCHEDULED / RECRUITING / ACTIVE** (DRAFT·INACTIVE는 매니저 수동 관리). 지원 마감일이 없으면 전환 안 함.
- [ ] **지원 시작일이 미래**인 프로그램 → **SCHEDULED(접수 예정)**. 아직 접수 안 됨, 지원자 홈에 노출 안 됨
  - (개설 시 ACTIVE로 만들어도 날짜 기준으로 즉시 SCHEDULED로 재계산됨)
- [ ] 오늘이 **시작일~마감일 사이** → RECRUITING(접수중), 지원자 홈에 노출
- [ ] 지원 마감일이 **과거** → 다음 스케줄러 실행(부팅 직후 1회 + 매시간) 또는 매니저 날짜 수정 시 ACTIVE(평가중)
- [ ] 시작일이 **없는** 경우 → SCHEDULED 없이 마감일 기준으로만 RECRUITING/ACTIVE 판정(기존 동작)
- [ ] 매니저가 날짜를 수정하면 **즉시 재계산**(생성/수정 시점 반영)
- [ ] DRAFT / INACTIVE는 자동 전환 대상 아님 — 자동으로 안 바뀜

> 빠른 검증 팁 1: 지원 시작일을 **내일**, 마감일을 **모레**로 개설 → 상태가 **SCHEDULED(접수 예정)** 로 뜨는지.
> 빠른 검증 팁 2: 지원 마감일을 **어제**로 수정 → 저장 즉시 **ACTIVE** 되는지.

---

## 7. 실시간 동기화

- [ ] 매니저 창과 심사위원 창을 동시에 열어두고, 심사위원이 제출 → 매니저 결과/현황이 새로고침 없이 갱신되는지(`useRealtimeSync`)
- [ ] 매니저가 팀 판정(합격/불합격) 변경 → 관련 화면 실시간 반영
- [ ] 지원자가 지원서 제출 → 매니저 팀 목록/심사위원 대상 목록에 반영

---

## 8. 네거티브 / 엣지 케이스 총정리

| # | 시나리오 | 기대 |
|---|---|---|
| N1 | 잘못된 역할로 로그인 | 401 |
| N2 | 중복 이메일(가입/유저생성) | 409 |
| N3 | 비-심사위원 배정 | 400 User is not an evaluator |
| N4 | 심사위원 중복 배정 | 409 Assignment already exists |
| N5 | 제출된 배정 취소 | 400 Cannot cancel a submitted assignment |
| N6 | 항목 미완성 제출 | 400 All criteria must be scored |
| N7 | 점수 0~10 벗어남 | 400 Score must be between 0 and 10 |
| N8 | 타 프로그램 criterion 제출 | 400 Criterion does not belong |
| N9 | 한줄평 500자↑/줄바꿈 | 400 |
| N10 | 가산점 비활성 입력 | 400 Bonus is not enabled |
| N11 | 가산점 음수/초과 | 400 |
| N12 | 지원-비접수/마감 프로그램 지원 | 400 |
| N13 | 미제출 지원팀 평가 접근 | 404 Team is not available |
| N14 | 남의 지원서/배정/첨부 접근 | 403 |
| N15 | PDF 아닌 첨부 업로드 | 400 Only PDF files |
| N16 | 20MB 초과 업로드 | 거부 |
| N17 | 날짜 순서 위반 프로그램 생성/수정 | 400 |
| N18 | 팀 중복 팀원 추가 | 409 Member already in team |
| N19 | 평가 마감일 경과 후 제출 | 400 평가 마감일이 지나 제출할 수 없습니다 |

---

## 9. 내보내기 결과 검증 (엑셀 / PDF)

### 9.1 엑셀(.xlsx) — 전체팀 / 최종합격
- [ ] "전체 정보(Excel)" 다운로드 → `..._전체평가.xlsx`
- [ ] "최종 결과(합격자)" Excel → `..._최종합격.xlsx`
- [ ] 열 구성: 순위·팀명·**심사위원(이름)**·평균·(가산점·총합)·판정
- [ ] **심사위원 열이 이메일이 아니라 이름**으로 표시 (이름 미설정 계정은 이메일로 대체) — *백엔드 재시작 필수*
- [ ] **1행(헤더)이 굵게** 처리되고, 스크롤해도 **1행 고정**
- [ ] 점수가 문자열이 아니라 **숫자 셀**(엑셀에서 정렬·합계 가능)
- [ ] 동명이인이 있어도 열이 안 섞임(내부적으로 심사위원 ID로 구분)

### 9.2 PDF(인쇄)
- [ ] "팀별 상세 정보"/"최종 결과" PDF 인쇄 미리보기 → 심사위원 **이름** + 점수 + 한줄평
- [ ] 팝업 차단 시 안내 문구 노출
- [ ] (미구현/보류) 첨부 PDF 병합은 아직 없음 — 추후 백엔드 작업 예정

---

## 부록 A. 알아두면 좋은 동작(직관과 다를 수 있는 지점)
- 평가 **배정은 팀별이 아니라 프로그램별**. 심사위원은 그 프로그램의 평가 가능한 팀 전부를 본다.
- **평가 마감일이 지나면 최종 제출이 막힌다**(400). 단 임시저장은 허용, 마감일이 없으면 제한 없음.
- 지원서 **제출 전 팀은 매니저·심사위원에게 숨김**. 제출해야 평가 대상이 된다.
- 매니저가 **직접 만든 팀**(지원서 없음)은 항상 평가 대상.
- 매니저 목록 조회는 **SUPER_ADMIN 전용**.
- 심사위원 **총점 = 항목 점수 합계**, 결과의 **평균 = 총점들의 평균**.
