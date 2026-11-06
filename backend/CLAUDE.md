# CLAUDE.md

이 파일은 EvalHub 백엔드를 다룰 때의 가이드입니다.
인증·전화번호 규칙·공유 열거형 등 프론트와 공유하는 규약은 저장소 루트의 `CLAUDE.md`에 있습니다.

## 명령어

```bash
# PostgreSQL 시작 (앱 실행 전 필수)
docker-compose up -d

# 빌드
./gradlew build

# 실행 (앱은 8080 포트에서 시작)
./gradlew bootRun

# 테스트 실행
./gradlew test

# 단일 테스트 클래스 실행
./gradlew test --tests "com.example.evalhub.PhoneNumbersTest"
```

Swagger UI: http://localhost:8080/swagger-ui.html
API 문서: http://localhost:8080/v3/api-docs

### Windows 한글 경로와 인코딩

Gradle 8.14.4와 Java 21에서 테스트 워커의 클래스패스를 담은 인자 파일(`@argfile`)이 UTF-8로 쓰이고,
Windows JDK 런처가 이를 시스템 인코딩(한국어 Windows에서는 MS949)으로 읽으면 한글 경로가 깨집니다.
증상은 `ClassNotFoundException: worker.org.gradle.process.internal.worker.GradleWorkerMain`입니다.

- `gradle.properties`: `org.gradle.jvmargs=-Dfile.encoding=COMPAT`으로 Gradle이 시스템 기본 인코딩을 사용하게 합니다.
- `build.gradle`: `tasks.withType(JavaCompile).configureEach { options.encoding = 'UTF-8' }`로 메인·테스트 Java 소스는 UTF-8을 유지합니다.
- 저장소·Gradle 캐시 경로 이동이나 Windows 시스템 인코딩 변경 없이, 추가 JVM 옵션 없이 실행합니다.
- 사용자 전역 `~/.gradle/gradle.properties`나 명령행의 `org.gradle.jvmargs`가 프로젝트 값을 덮어쓰는 경우 인코딩 설정도 함께 유지하세요.

```powershell
# backend 디렉토리에서 실행. 통합 테스트에는 PostgreSQL이 필요합니다.
docker compose up -d
.\gradlew.bat test

# 평가 점수 저장 관련 테스트만 실행
.\gradlew.bat test --tests '*EvaluationScoreReplacementTest' --tests '*EvaluationScoreReplacementIntegrationTests'
```

관련 Gradle 이슈: https://github.com/gradle/gradle/issues/30304

## 스택

- Java 21, Spring Boot 3.5, Spring Data JPA (Hibernate), PostgreSQL 15
- Spring Security + JJWT — 인증은 JWT를 httpOnly 쿠키로 처리합니다 (루트 `CLAUDE.md`의 "인증" 참고)
- 스키마 마이그레이션은 Flyway 사용 (`src/main/resources/db/migration/`)
- 보일러플레이트 감소를 위한 Lombok
- Swagger용 springdoc-openapi
- `ddl-auto: validate` — Hibernate는 스키마를 DB와 대조하여 검증만 할 뿐 절대 수정하지 않음. 모든 스키마 변경은 Flyway 마이그레이션을 통해서만 진행

## 아키텍처

`com.example.evalhub` 바로 아래에 역할별 디렉토리가 평탄하게 놓인 구조입니다.

`config`, `controller`, `dto`, `entity`, `repository`, `scheduler`, `security`, `service`, `util`

### 도메인 모델

두 갈래의 흐름이 `Team`에서 만납니다.

**지원 흐름** — `Program → Application → Team`

- `Program` — 평가 프로그램. 매니저 `User`가 소유. 지원/평가 기간, 참가 유형(개인/팀), 첨부파일 허용 여부, 가산점 설정을 가집니다
- `Application` — 한 지원자(`User`)의 프로그램 지원서. `DRAFT` / `SUBMITTED`. 제출 대상 `Team`을 함께 만듭니다. `(program, applicant)` 쌍마다 유일합니다
- `ApplicationFormField` — 매니저가 프로그램마다 정의하는 지원 양식 항목 (`TEXT` / `RADIO` / `CHECKBOX`, `displayOrder`로 정렬)
- `ApplicationAnswer` — 지원서의 항목별 답변
- `Team` — **평가 대상 단위.** 개인 지원도 1인 팀으로 저장됩니다. 지원자가 입력한 본인·팀원 정보는 `applicant_info` 컬럼에 JSON(`ApplicantInfo`)으로, 대표 연락처는 `participant_phone` 컬럼에 따로 저장합니다. 심사 결과(`PENDING`/`PASSED`/`FAILED`)와 매니저 가산점도 여기 있습니다
- `TeamMember` — 팀에 연결된 실제 계정(`User`). 지원서에 적힌 명단(`applicant_info`)과는 별개입니다
- `ParticipantAttachment` — 팀에 업로드된 PDF

**평가 흐름** — `Program → EvaluationAssignment → EvaluationSubmission → EvaluationScore`

- `EvaluationCriterion` — 프로그램의 채점 항목. `scaleType`(`SCORE` / `PASS_FAIL`), `maxScore`(기본 10), `weight`, `displayOrder`
- `EvaluationAssignment` — **`Program`과 심사위원 `User`를 연결합니다.** 팀 단위가 아니라 프로그램 단위이므로, 배정 하나로 그 프로그램의 모든 팀을 평가합니다
- `EvaluationSubmission` — `(assignment, team)` 쌍마다 하나. 즉 심사위원 한 명이 팀 하나에 매기는 답안지입니다. `DRAFT` / `SUBMITTED`
- `EvaluationScore` — submission의 항목당 점수 하나

> 예전 문서에 있던 `ProgramParticipant` 엔티티는 삭제되었습니다. 평가 대상은 `Team`이 직접 맡습니다.

### 총점 계산

`EvaluationService.calculateTotalScore()` — **항목별 점수의 평균이 아니라 합계입니다.**
매니저 가산점(`Team.bonusScore`)은 여기 포함되지 않고, 결과 조회·내보내기 시점에 따로 더합니다.

### 권한 검사

역할 기반 접근 제어는 controller의 `@PreAuthorize`로 처리합니다. **서비스 계층에서 역할을 수동으로 확인하지 마세요.**
자세한 규칙(공개 경로, `ROLE_` 접두어, 로그인 시 역할 검증)은 루트 `CLAUDE.md`의 "인증"에 있습니다.

### Controller → Service 패턴

Controller는 얇게(thin) 유지되며 전적으로 service에 위임합니다. Service는 생성자 주입 방식을 사용하며 (`@Autowired` 미사용), 모든 mutating 메서드는 `@Transactional`, 읽기 전용 메서드는 `@Transactional(readOnly = true)`를 사용합니다.

에러는 서비스 계층에서 `ResponseStatusException`을 직접 던지는 것이 기본입니다. `ProgramManagementService`의 `notFound()` 헬퍼가 표준 패턴입니다.

`config/GlobalExceptionHandler`가 있지만 **의도적으로 좁게 잡혀 있습니다.** `DataIntegrityViolationException`을 409로 바꾸는 핸들러 하나뿐이고, `Exception` 전체를 받는 핸들러는 두지 않습니다. Spring Security가 403으로 변환해야 할 `AccessDeniedException`까지 가로채 500으로 만들기 때문입니다. 핸들러를 추가할 때 이 점을 지키세요.

### 서비스 클래스

- `ProgramManagementService` — 프로그램, 팀, 평가 항목, 심사위원·매니저 계정, 배정 CRUD
- `EvaluationService` — 심사위원용. 평가 화면 데이터 일괄 조회, 임시저장, 최종 제출
- `ApplicationService` — 지원자용. 회원가입, 지원서 작성·제출·취소, 팀 정보 수정
- `ParticipantAttachmentService` — PDF 업로드·삭제·조회
- `RealtimeUpdateService` — 변경 알림 브로드캐스트 (아래 참고)

`EvaluationService`의 임시저장과 제출은 내부 `save()`를 공유하며 `submit` 불리언으로 구분합니다.

### 실시간 갱신 (SSE)

`GET /api/events`가 SSE 스트림을 엽니다. 프론트는 `change` 이벤트를 받으면 활성 쿼리를 일괄 무효화합니다.

**알림은 `config/RealtimeUpdateInterceptor`가 자동으로 발행합니다.** `POST`/`PUT`/`PATCH`/`DELETE` 요청이 예외 없이 2xx~3xx로 끝나면 `RealtimeUpdateService.publishChange()`가 호출됩니다 (`/api/auth/*`는 제외).
따라서 **새 쓰기 API를 추가할 때 알림 코드를 직접 넣을 필요가 없습니다.** 서비스 계층에서 `publishChange()`를 호출하면 중복 발행이 됩니다.

### 프로그램 상태 자동 전환

`scheduler/ProgramStatusScheduler`가 서버 기동 직후 1회, 이후 실행 완료 30초 후 실행되며 시각에 따라 프로그램 상태를 넘깁니다 (`SCHEDULED` → `RECRUITING` → `PENDING_EVALUATION` → `ACTIVE` → `INACTIVE`). `DRAFT`와 수동 `INACTIVE`는 유지하고, 실제 변경 시 커밋 후 SSE 갱신을 알립니다.
매니저가 기간을 직접 수정하는 경우는 생성·수정 시점에 즉시 반영되므로, 스케줄러는 시간 경과만 담당합니다.

### CORS

허용된 origin: `http://localhost:3000` (프론트엔드 dev 서버). `WebConfig`에서 설정됨.
다만 dev 서버가 `/api/*`를 프록시하므로 브라우저 입장에서는 동일 출처라, 평소 개발 중에는 CORS가 관여하지 않습니다.

### PDF 저장

파일은 `evalhub.storage.attachments-path`에 설정된 경로(기본값 `uploads/attachments`)에 로컬로 저장됩니다. 최대 업로드 크기: 파일당 20MB / 요청당 25MB. `application/pdf` 콘텐츠 타입만 허용됨 (DB check constraint로 강제).

### 스키마 마이그레이션

`src/main/resources/db/migration/`에 `V1`부터 순서대로 쌓여 있습니다 (현재 `V18`까지).
**기존 마이그레이션 파일은 절대 수정하지 마세요.** 컬럼이나 테이블을 추가할 때는 다음 번호의 새 파일(`V19__...`)을 만듭니다.
`ddl-auto: validate`이므로 엔티티에 필드를 추가하고 마이그레이션을 빠뜨리면 앱이 시작 시 크래시합니다.
