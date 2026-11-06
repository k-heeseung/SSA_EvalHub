# 첨부파일 저장 일관성과 제출 검증

## 처리 규칙

- 업로드 파일은 DB 트랜잭션이 롤백되면 삭제한다. 파일 전송 중 오류로 생긴 부분 파일과 DB 저장 실패로 남은 파일도 정리한다.
- 첨부 삭제는 DB 커밋 후 실제 파일을 삭제한다. 롤백되면 실제 파일을 보존한다.
- 파일 정리 실패와 트랜잭션 결과 불명 상태는 서버 로그에 경로와 오류를 남긴다. 커밋 후 파일 정리 오류 때문에 성공한 DB 작업을 실패 응답으로 바꾸지 않는다.
- 업로드, 삭제, 최종 제출은 같은 팀 행 잠금을 사용한다.
- 최종 제출에서는 선택 첨부를 포함한 모든 첨부의 실제 파일 존재, 저장소 내부 경로, 일반 파일 여부, 읽기 가능 여부와 크기를 검증한다. 0바이트 파일은 허용하지 않는다.
- 첨부가 없을 때의 필수/선택 항목 규칙은 유지한다. 잘못된 첨부가 있으면 삭제 후 재업로드를 안내하고 제출을 막는다. 임시저장은 허용한다.

## 검증

```powershell
.\gradlew.bat test --offline --tests com.example.evalhub.ParticipantAttachmentServiceTest --tests com.example.evalhub.AttachmentSubmissionIntegrationTests --tests com.example.evalhub.ProgramScheduleBoundaryIntegrationTests --tests com.example.evalhub.RequiredCheckboxIntegrationTests
```

단위 테스트는 업로드/삭제 성공, DB 오류, 부분 전송 실패와 커밋/롤백 콜백을 검사한다. 통합 테스트는 실제 DB 롤백 시 파일 처리와 실제 파일 누락/크기 불일치/잘못된 경로에 대한 제출 차단을 검사한다.

## 적용 범위

스키마/API 변경과 배포 설정 변경은 없다. 프로세스 강제 종료로 콜백이 실행되지 않거나 디스크 오류로 정리에 실패하면 불필요한 파일이 남을 수 있다. 자동 재시도나 정기 대조는 이번 범위에 포함하지 않는다. 동일 크기의 내용 변조를 탐지하는 해시 검증도 포함하지 않는다.

운영 파일 보존을 위한 영구 볼륨/백업과 프록시 설정은 별도로 구성하고 배포 환경에서 검증해야 한다.
