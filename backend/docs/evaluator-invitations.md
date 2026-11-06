# 심사위원 계정 안내 메일

## 배포 전 로컬 사용

기본값은 Gmail 발송 비활성화다. OAuth 정보가 없어도 애플리케이션이 시작된다.
심사위원 생성에는 임시 비밀번호를 재시작 후에도 복호화할 수 있는 암호화 키가 필요하다.
키 미설정 시 생성 요청은 503으로 거절하며 계정을 만들지 않는다. 화면에도 설정 준비 상태를 표시한다.

PowerShell에서 최초 한 번 키를 생성해 **개인 비밀 저장소에 보관**한다. 생성할 때마다 키를 바꾸지 않는다.
아래 코드는 화면에 키를 출력하지 않는다. 이후 실행에서도 같은 키를 환경변수에 공급해야 한다.

```powershell
$keyBytes = [byte[]]::new(32)
$keyGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $keyGenerator.GetBytes($keyBytes)
    $env:EVALHUB_MAIL_ENCRYPTION_KEY = [Convert]::ToBase64String($keyBytes)
} finally {
    $keyGenerator.Dispose()
}
# 이 터미널에서 실행. 메일은 발송되지 않고 DB에 PENDING 상태로 저장된다.
.\gradlew.bat bootRun
```

프로세스를 재시작할 때는 비밀 저장소에서 기존 키를 다시 주입한다. 키를 잃으면 대기 작업의 비밀번호를
복구할 수 없다. 현재 암호문 포맷은 `v1.nonce.ciphertext`이며 AES-256-GCM과 사용자 ID AAD를 사용한다.
키 교체 시 미삭제 암호문을 기존 키로 복호화해 새 키로 재암호화하는 별도 절차가 필요하다.
개발용으로 생성한 계정도 키 보관 기간은 기본 7일이다. 발송을 활성화하면 만료되지 않은 대기 작업이
발송되므로, 실제 수신 가능한 테스트 이메일만 사용한다.

## 전용 Gmail 계정 연결 (배포 없이 가능)

1. Google Cloud 프로젝트를 만들고 Gmail API를 활성화한다.
2. Google Auth Platform에서 Branding, Audience, Data Access를 설정한다.
   발송 권한은 `https://www.googleapis.com/auth/gmail.send`만 요청한다.
3. 개인 Gmail은 External로 설정한다. 개발 중 Testing 상태에서는 전용 발신 계정을 테스트 사용자로 추가한다.
4. 로컬 최초 연결용으로 OAuth **Desktop app** 클라이언트를 생성한다.
   이 도구는 데스크톱 클라이언트의 루프백 콜백을 사용하므로 배포된 URL이 필요 없다.
   웹 애플리케이션 OAuth 클라이언트와 혼용하지 않는다.
5. 같은 PowerShell 터미널에서 client ID와 client secret을 환경변수에 주입한다.

```powershell
$env:EVALHUB_GMAIL_CLIENT_ID = '<Desktop OAuth client ID>'
$env:EVALHUB_GMAIL_CLIENT_SECRET = '<Desktop OAuth client secret>'
python tools/gmail_oauth.py
```

브라우저에서 반드시 전용 발신 계정으로 동의한다. PKCE 및 state를 검사하고 토큰은 콘솔 대신
gitignore된 `backend/.gmail-oauth.local.json`에 저장한다. 이 파일도 비밀 파일이므로 공유하거나 커밋하지 않는다.
이 도구는 사용자가 명시적으로 실행할 때만 Google 계정을 연결한다.

```powershell
$env:EVALHUB_GMAIL_REFRESH_TOKEN = (Get-Content -Raw .gmail-oauth.local.json | ConvertFrom-Json).refresh_token
$env:EVALHUB_MAIL_SENDER = '<동의한 전용 발신 계정 이메일>'
$env:EVALHUB_MAIL_LOGIN_URL = 'http://localhost:3000/login?role=evaluator'
$env:EVALHUB_MAIL_ENABLED = 'true'
# 기존에 보관한 EVALHUB_MAIL_ENCRYPTION_KEY도 같은 터미널에 공급한다.
.\gradlew.bat bootRun
```

발신 계정만 OAuth를 연결하며 매니저와 심사위원은 Google 연결이 필요 없다.
External + Testing으로 발급한 refresh token은 Gmail 권한 사용 시 7일 후 만료된다.
운영 전 Audience에서 In production으로 전환하고 필요 검증/예외 요건을 확인한 뒤 새로 동의해 토큰을 교체한다.
기존 로컬 토큰 파일을 비밀 저장소로 옮겨야 도구를 다시 실행할 수 있다.
유료 Workspace 가입으로 토큰 만료를 해결하는 구조가 아니다.
운영에서도 권한 철회·발신 계정 비밀번호 변경 등으로 토큰이 무효화될 수 있다.
이때 AUTH_REQUIRED가 표시되며, 재연결 후 실패 작업을 수동 재시도한다.

## 서버 설정

| 환경변수 | 기본값 / 설명 |
|---|---|
| EVALHUB_MAIL_ENABLED | false |
| EVALHUB_MAIL_ENCRYPTION_KEY | 없음. Base64로 인코딩한 32바이트 키 |
| EVALHUB_GMAIL_CLIENT_ID | 없음 |
| EVALHUB_GMAIL_CLIENT_SECRET | 없음 |
| EVALHUB_GMAIL_REFRESH_TOKEN | 없음 |
| EVALHUB_MAIL_SENDER | 없음. 동의한 계정 이메일 |
| EVALHUB_MAIL_LOGIN_URL | http://localhost:3000/login?role=evaluator |
| EVALHUB_MAIL_RETENTION | 7d |
| EVALHUB_MAIL_MAX_ATTEMPTS | 5 (수동 재시도 한 주기 내 최초 시도 포함) |
| EVALHUB_MAIL_POLL_INTERVAL_MS | 10000 |

발송 활성화 시 OAuth 필수값과 암호화 키가 잘못되었으면 시작 단계에서 실패한다.
배포 시 LOGIN_URL을 실제 HTTPS 서비스 주소로 교체한다. `?role=evaluator`를 포함하면 심사위원 탭이 선택된다. 이 설정은 발송 시 읽는다.
환경변수는 Spring Boot가 읽는다. `.env` 파일을 자동으로 읽지는 않는다.

## API

모든 초대 API는 SUPER_ADMIN / MANAGER 전용이다. 쿠키 인증과 기존 CSRF 규칙을 그대로 적용한다.

- `POST /api/evaluators`: `{email, name, department}`. 역할은 서버에서 EVALUATOR로 고정한다.
  비밀번호는 서버 SecureRandom으로 생성하며 응답에 포함하지 않는다. 기존 UserResponse를 반환한다.
- `GET /api/evaluator-invitations`: `{deliveryEnabled, creationEnabled, invitations:[...]}`.
- `GET /api/evaluators/{id}/invitation`: 개별 발송 상태 조회. 기존 계정에 초대 작업이 없으면 404.
- `POST /api/evaluators/{id}/invitation/retry`: 실패 작업만 예약한다.
  비밀번호 변경·만료 이후에는 불가하며 최근 시도 후 1분의 대기 시간을 둔다.
  시도 횟수를 새 주기로 초기화한다. 새 비밀번호를 발급하지 않는다.
- 기존 `POST /api/users`의 EVALUATOR 생성은 400으로 차단한다. 매니저 등 기존 생성 경로는 유지한다.

발송 상태 응답에는 userId, status, attemptCount, nextAttemptAt, expiresAt, lastAttemptAt, sentAt,
errorCode, retryAllowed만 포함한다. 비밀번호와 암호문은 노출하지 않는다.

## 발송과 정리

V22 마이그레이션으로 outbox 테이블을 추가한다. JPA 사용자 저장과 JDBC outbox 저장은 동일한 트랜잭션이다.
Google REST API는 Java HttpClient로 호출하고 JSON은 기존 Jackson을 사용한다. 추가 메일 의존성은 없다.
UTF-8 MIME 메시지를 Base64URL로 인코딩해서 `users.messages.send`로 전달한다.
Gmail에 보낸 본문에는 지정된 제목, 이메일, 실제 임시 비밀번호, 변경 안내, 로그인 링크만 포함한다.

스케줄러는 커밋된 작업만 처리한다. `FOR UPDATE SKIP LOCKED`로 작업을 점유하고 5분 점유 기한과 토큰으로
서버 중단 후 복구한다. 한 번에 최대 10건 처리한다. 호출 연결 제한은 10초, 토큰 갱신은 20초,
발송 요청은 30초이며 401은 토큰을 갱신해 한 번 더 호출한다.
작업을 처리할 때 user → invitation 순서로 잠그며 HTTP 호출까지 유지한다.
따라서 발송 중 해당 사용자의 비밀번호 변경·삭제는 잠시 대기할 수 있다.
비밀번호 변경 커밋 후 이전 비밀번호로 새 발송을 시작하지 않도록 하기 위한 선택이다.
이미 Gmail에 넘긴 요청이나 수신된 메일은 취소할 수 없다.

상태: PENDING / PROCESSING / RETRY_WAIT / SENT / FAILED / CANCELLED / EXPIRED.
SENT는 API 요청 성공이며 수신함 도착 보장이 아니다.
네트워크 오류, 429, 일부 403, 5xx는 지수 백오프와 무작위 지연으로 재시도하고 Retry-After도 반영한다.
복구 불가 인증·권한·요청 오류는 즉시 FAILED로 종료한다.
네트워크 타임아웃 또는 발송 후 DB 저장 전 종료 시 메일이 중복 도착할 수 있다.

성공 후에도 암호문을 보관하며 비밀번호 변경 또는 보관 만료 시 삭제한다.
발송 이력은 유지한다. 계정 삭제 시 FK cascade로 초대와 암호문도 삭제한다.
만료 정리는 발송 비활성화 상태에서도 주기적으로 수행하며 서버 중단 중 지난 기한은 재시작 후 정리한다.
보관 만료가 계정 비밀번호의 로그인 만료를 의미하지는 않는다.
로그에는 비밀번호·토큰·본문·Google 원문 오류를 남기지 않는다.

## 검증

```powershell
# 기존 개발 데이터와 분리된 테스트 스키마. Flyway가 생성한다.
$env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://localhost:5432/evaluation_platform?currentSchema=evalhub_invitation_test'
$env:SPRING_FLYWAY_SCHEMAS = 'evalhub_invitation_test'
$env:SPRING_FLYWAY_DEFAULT_SCHEMA = 'evalhub_invitation_test'
.\gradlew.bat test --tests '*Invitation*' --tests '*SessionAuthenticationIntegrationTests'
```

테스트는 Gmail을 대체해 실제 메일을 보내지 않는다. 인증·암호화·본문·재시도·삭제·API 권한을 검증한다.
테스트용 datasource 환경변수는 검증용 터미널에서만 설정한다.
실제 발송은 전용 계정 연결 후 본인의 테스트 이메일로 계정을 생성해 확인한다.

공식 참고:
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/guides/handle-errors
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/identity/protocols/oauth2#expiration
