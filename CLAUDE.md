# CLAUDE.md

이 파일은 EvalHub 프로젝트 전체에 대한 Claude Code 가이드입니다.
각 하위 디렉토리에 세부 가이드가 있습니다:
- `backend/CLAUDE.md` — Spring Boot, Flyway, 도메인 모델, 서비스 패턴
- `frontend/CLAUDE.md` — React, 라우팅, API 레이어, 페이지 구조

## 풀스택 실행

```bash
# 1. PostgreSQL 시작
cd backend && docker-compose up -d

# 2. 백엔드 실행 (포트 8080)
cd backend && ./gradlew bootRun

# 3. 프론트엔드 실행 (포트 3000)
cd frontend && npm install && npm run dev
```

프론트엔드 dev 서버가 `/api/*`를 `http://localhost:8080`으로 프록시하므로, 프론트엔드 코드에 백엔드 URL을 하드코딩하지 않습니다.

## Windows Gradle 테스트 실행

`backend/gradle.properties`의 `org.gradle.jvmargs=-Dfile.encoding=COMPAT`은 Gradle 테스트 워커의 한글 경로가 깨지는 문제를 방지합니다.
Java 소스는 `backend/build.gradle`의 `JavaCompile.options.encoding = 'UTF-8'` 설정으로 계속 UTF-8로 컴파일합니다.
프로젝트나 Gradle 캐시를 다른 경로로 옮기거나 Windows 시스템 인코딩을 변경할 필요는 없습니다.
Java 21과 PostgreSQL이 준비되면 `backend`에서 PowerShell의 `.\gradlew.bat test`로 실행합니다. 추가 인코딩 옵션은 필요 없습니다.
자세한 원인과 명령어는 `backend/CLAUDE.md`의 "Windows 한글 경로와 인코딩"을 참고하세요.

## 프론트엔드 ↔ 백엔드 API 계약

| 기능 | 엔드포인트 |
|---|---|
| 로그인 / 로그아웃 | `POST /api/auth/login`, `POST /api/auth/logout` |
| 현재 로그인 사용자 | `GET /api/auth/me` |
| 비밀번호 변경 (본인) | `PUT /api/auth/password` |
| 지원자 회원가입 | `POST /api/signup` |
| 프로그램 CRUD | `GET/POST/PUT /api/programs` |
| 프로그램 소속 팀 | `GET/POST /api/programs/{id}/teams` |
| 지원 양식 항목 | `GET/PUT /api/programs/{id}/form-fields` (PUT은 id 기준 diff — 아래 참고) |
| 평가 기준 | `GET/POST /api/programs/{id}/criteria` |
| 심사위원 목록 | `GET /api/evaluators` |
| 심사 배정 | `GET/POST /api/programs/{id}/assignments` |
| 평가 뷰 조회 | `GET /api/evaluation-assignments/{id}/view` |
| 임시저장 | `PUT /api/evaluation-assignments/{id}/draft` |
| 최종 제출 | `PUT /api/evaluation-assignments/{id}/submit` |
| PDF 업로드 | `POST /api/teams/{teamId}/attachments` |
| PDF 열람 (inline) | `GET /api/attachments/{id}/content` |

엔드포인트를 추가하거나 변경할 때는 프론트(`src/api/`)와 백엔드 controller를 반드시 함께 수정하세요.

### 지원 양식 항목 저장 (`PUT /api/programs/{id}/form-fields`)

**항목을 통째로 지우고 다시 만들면 안 됩니다.** `application_answers.form_field_id`가 `on delete cascade`라, 항목을 지우는 순간 지원자가 제출한 답변이 전부 함께 삭제됩니다.

그래서 이 PUT은 전체 교체가 아니라 **id 기준 diff**로 동작합니다:

- `id`가 있는 항목 → 기존 행을 제자리에서 수정 (id 유지 → 답변 보존)
- `id`가 `null` → 새 항목으로 추가
- 요청에 없는 기존 항목 → 삭제. 단 **이미 답변이 달린 항목이면 409**로 막습니다

프론트는 서버에서 받은 id를 `serverId`로 들고 있다가 저장할 때 그대로 돌려보냅니다 (`CreateProgramPage.jsx`). 화면 조작용 로컬 key인 `id`와는 별개입니다 — 새 항목의 로컬 key(`Date.now()`)를 서버 id로 보내면 안 됩니다.

## 공유 열거형 값

프론트와 백엔드가 동일한 문자열 값을 사용합니다. 한쪽만 바꾸면 깨집니다.

- **배정 상태:** `ASSIGNED` → `IN_PROGRESS` → `SUBMITTED`
- **팀 상태:** `PENDING` | `PASSED` | `FAILED`
- **프로그램 타입:** `MODULE_A` | `MODULE_B`
- **프로그램 상태:** `DRAFT` → `SCHEDULED` → `RECRUITING` → `PENDING_EVALUATION` → `ACTIVE` → `INACTIVE`
  - `SCHEDULED`=접수 예정(지원 시작일 전), `PENDING_EVALUATION`=평가 대기(지원 마감 후 평가 시작일 전), `ACTIVE`=평가 진행, `INACTIVE`=평가 완료
  - `DRAFT`를 제외한 전환은 시각에 따라 자동으로 이뤄집니다 (`ProgramManagementService.resolveAutoStatus`, 기동 직후 및 실행 완료 30초 후 `ProgramStatusScheduler`)
- **사용자 역할:** `SUPER_ADMIN`, `MANAGER`, `EVALUATOR`, `MEMBER`

## 전화번호 저장 규칙

전화번호는 **숫자만 남긴 형태로 저장**하고, 하이픈은 화면에 표시할 때만 붙입니다.
같은 번호가 `010-1234-5678` / `01012345678`로 나뉘어 저장되면 중복 지원 확인·검색·문자 발송이 모두 깨집니다.

- 규칙 구현: `backend/.../util/PhoneNumbers.java` ↔ `frontend/src/utils/phone.js` (**두 파일은 같은 규칙을 따라야 하므로 항상 함께 수정**)
- 입력: 자유 형식 허용. 프론트에서 타이핑 중 자동으로 하이픈을 붙임 (`formatPhoneInput`)
- 전송: 프론트가 `toDigits()`로 숫자만 보냄
- 저장 위치: `users.phone`, `teams.participant_phone`(대표 연락처), `teams.applicant_info` JSON의 `phone` / `members[].phone`
  - `teams.participant_phone`이 대표 연락처의 기준값입니다. JSON에도 같은 값이 들어가지만 조회는 `ApplicantInfo.of(team)`이 컬럼을 우선합니다.
- 검증: 국내 번호만 허용 (0으로 시작하는 9~11자리, 또는 1로 시작하는 8자리 대표번호)
  - 임시저장은 미완성 번호를 버리지 않도록 자릿수를 검증하지 않음 (`toDigits`)
  - 제출·팀 정보 수정 시에만 형식 검증 (`normalize` / `isValid`)
- 연락처는 **선택 항목**입니다. 비어 있으면 통과하고, 입력했을 때만 형식을 검사합니다.

## CORS

백엔드는 `http://localhost:3000`만 허용합니다. 설정 위치: `backend/src/main/java/com/example/evalhub/config/WebConfig.java`.

## 스키마 변경 규칙

모든 DDL 변경은 새 Flyway 마이그레이션 파일(`backend/src/main/resources/db/migration/V{n}__description.sql`)로 추가합니다. 기존 마이그레이션 파일은 절대 수정하지 마세요. 백엔드가 `ddl-auto: validate`를 사용하므로 마이그레이션이 누락되면 앱 시작 시 크래시가 발생합니다.

## 인증

Spring Security 기반이며, **JWT를 httpOnly 쿠키로 주고받습니다.** 서버는 세션을 만들지 않습니다 (`SessionCreationPolicy.STATELESS`).
설정 위치: `backend/.../config/SecurityConfig.java`, 관련 클래스는 `backend/.../security/`에 모여 있습니다.

### 토큰과 쿠키

| 항목 | 값 |
|---|---|
| 쿠키 이름 | `EVALHUB_ACCESS_TOKEN` |
| 속성 | `httpOnly`, `SameSite=Lax`, `path=/`, `secure`는 설정값 |
| 유효기간 | 기본 30분 / `rememberMe`면 30일 |

로그인(`POST /api/auth/login`)이 이 쿠키를 내려주고, 이후 모든 요청은 `JwtAuthenticationFilter`가 쿠키에서 토큰을 읽어 인증합니다.
**토큰은 신뢰의 유일한 근거가 아닙니다.** 토큰의 `uid`·`role`을 DB의 사용자와 대조해서 일치할 때만 인증을 통과시킵니다.

프론트는 쿠키를 직접 다루지 않습니다. `httpOnly`라 JS에서 읽을 수 없고, `api/client.js`가 `withCredentials: true`로 자동 전송합니다.

### CSRF

쿠키 인증이므로 CSRF 방어가 켜져 있습니다.

- 서버가 `XSRF-TOKEN` 쿠키를 내려주고(`httpOnly` 아님), 요청은 `X-XSRF-TOKEN` 헤더로 되돌려 보내야 합니다
- axios가 이 규칙을 자동 처리하므로 **프론트에서 따로 붙일 필요는 없습니다** (`api/client.js`의 `xsrfCookieName` / `xsrfHeaderName`)
- 예외: `POST /api/auth/login`, `POST /api/signup`

### 권한 검사

`@EnableMethodSecurity` + controller의 `@PreAuthorize`로 처리합니다. 서비스 계층에서 역할을 수동으로 확인하지 마세요.

```java
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER')")  // ProgramManagementController (클래스 단위)
@PreAuthorize("hasRole('EVALUATOR')")                  // EvaluationController (클래스 단위)
@PreAuthorize("hasRole('MEMBER')")                     // ApplicantController
@PreAuthorize("permitAll()")                           // 클래스 기본값을 열어주는 예외 메서드
```

권한 문자열은 `ROLE_` 접두어가 붙습니다 (`hasRole('MANAGER')` ↔ `ROLE_MANAGER`).

**인증 없이 접근 가능한 경로:** `POST /api/auth/login`, `POST /api/signup`, `GET /api/programs/open`, `GET /api/programs/*/form-fields`, Swagger 경로. 그 외에는 전부 인증이 필요하며, 미인증 요청은 리다이렉트 없이 **401**을 반환합니다.

### 로그인할 때 역할을 함께 보냅니다

로그인 요청에는 이메일·비밀번호와 함께 `role`이 들어갑니다. 계정의 실제 역할과 맞지 않으면 거부됩니다.
예외는 하나로, **`MANAGER`로 로그인을 시도한 `SUPER_ADMIN` 계정은 허용**합니다 (`AuthController.isRoleCompatible`).

### 계정 상태를 매 요청 확인합니다

`SessionAccountValidationFilter`가 요청마다 DB를 확인해서, 계정이 `ACTIVE`가 아니거나 역할이 바뀌었으면 즉시 401로 끊습니다.
따라서 **관리자가 계정을 정지시키면 발급된 토큰이 남아 있어도 바로 차단됩니다.**

### 비밀번호

`PasswordEncoderFactories.createDelegatingPasswordEncoder()`를 사용합니다. 신규 비밀번호는 bcrypt로 저장되고, 해시에 `{bcrypt}` 같은 접두어가 붙습니다.
비밀번호를 직접 비교하거나 평문으로 저장하는 코드를 추가하지 마세요.

### 프론트엔드

- **현재 사용자는 `GET /api/auth/me`로 조회합니다.** `useCurrentUser()` 훅이 감쌉니다
- 라우트 보호는 `components/RequireAuth.jsx` — 역할이 맞지 않으면 해당 역할의 홈으로 돌려보냅니다
- 401 응답을 받으면 `api/client.js`가 쿼리 캐시를 비우고 `/login`으로 이동시킵니다
- **`localStorage`에 로그인 정보를 저장하지 않습니다.** 인증 상태의 근거는 쿠키와 `/api/auth/me` 응답뿐입니다. 프론트 코드 전체에 `localStorage` 사용처가 없으며, 로그인 사용자가 필요하면 `useCurrentUser()`를 쓰세요

### 설정값

`application.yml`의 `evalhub.security` (모두 환경변수로 덮어쓸 수 있습니다).

| 키 | 환경변수 | 기본값 |
|---|---|---|
| `jwt-secret` | `EVALHUB_JWT_SECRET` | 로컬 개발용 문자열 — **운영에서는 32바이트 이상 임의 값으로 반드시 교체** |
| `access-token-minutes` | `EVALHUB_JWT_ACCESS_MINUTES` | 30 |
| `remembered-token-days` | `EVALHUB_JWT_REMEMBERED_DAYS` | 30 |
| `secure-cookie` | `EVALHUB_SECURE_COOKIE` | false (HTTPS 환경에서는 true) |

### 개발 팁: 여러 역할 동시 로그인

인증이 쿠키 기반이라 **같은 브라우저 프로필에서는 한 번에 한 계정만 로그인할 수 있습니다.** 창을 여러 개 띄워도 쿠키를 공유하므로 마지막 로그인이 나머지를 덮어씁니다.
매니저·심사위원·지원자를 동시에 띄워 보려면 브라우저 프로필을 분리하세요 (Chrome 프로필, Firefox 컨테이너 탭 등).
프론트 포트를 나누는 방식은 소용이 없습니다 — 쿠키는 포트를 구분하지 않습니다.
