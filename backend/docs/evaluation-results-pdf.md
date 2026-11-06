# 평가 결과 PDF 다운로드

- `GET /api/programs/{programId}/evaluation-results/pdf?onlyPassed=false`
- 기존 평가 결과 조회와 동일하게 `MANAGER`, `SUPER_ADMIN`만 허용한다. 쿠키 인증을 사용한다.
- 성공 응답은 `application/pdf`, `Content-Disposition: attachment`와 UTF-8 파일명을 포함한다.
- 평가 결과는 민감 정보이므로 `Cache-Control: no-store`로 응답한다.
- 없는 프로그램은 404, 미인증은 401, 허용되지 않은 역할은 403이다.

기본값은 전체 팀의 상세 결과다. 제출된 평가만 평균과 총평에 포함하고, 가산점 항목의 합계를 한 번 더해 최종 점수를 계산한다. 최종 점수 내림차순으로 정렬하며 점수가 없는 팀은 마지막에 배치한다. `onlyPassed=true`는 합격 팀만 포함하며 심사위원별 점수·총평은 제외한다. 결과가 없어도 안내 문구가 담긴 유효한 PDF를 반환한다.

OpenPDF로 서버에서 문서를 생성한다. `src/main/resources/fonts`의 나눔고딕을 PDF에 포함하므로 서버 운영체제의 설치 글꼴이나 외부 폰트 서비스에 의존하지 않는다. 글꼴 출처는 [Google Fonts의 Nanum Gothic](https://github.com/google/fonts/tree/main/ofl/nanumgothic)이며, 배포 라이선스는 같은 폴더의 `OFL.txt`에 동봉한다. 긴 심사평은 페이지를 나누고 표 머리글을 반복한다.

프론트는 기존 API 클라이언트로 PDF를 Blob으로 받아 일반 파일 다운로드를 실행한다. HTTP 오류는 현재 화면에서 표시하며, 새 탭·인쇄창·화면 캡처·파일 시스템 접근 API는 사용하지 않는다. 기존 Excel 다운로드와 삭제된 상단 내보내기 버튼은 변경하지 않는다.

검증:

```powershell
.\gradlew.bat test --tests '*EvaluationResultsPdfServiceTest' --tests '*EvaluationResultExportControllerTest'
```

테스트는 한글 텍스트 추출, 점수·순위·합격 필터, 임시저장 제외, 긴 심사평의 마지막 문장, 빈 결과, API 권한·파일명 헤더를 확인한다. 시각 검증용 PDF는 `build/pdf-qa`에 생성한다. 새 라이브러리와 API 적용에는 백엔드 재빌드·재시작이 필요하다.
