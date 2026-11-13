---
name: EvalHub
description: 차분한 심사 기록부 — 읽기 편한 한글과 일관된 업무 조작부
colors:
  primary: oklch(54.6% 0.245 262.881)
  primary-hover: oklch(48.8% 0.243 264.376)
  primary-soft: oklch(97% 0.014 254.604)
  focus: oklch(62.3% 0.214 259.815)
  canvas: oklch(98.5% 0.002 247.839)
  subtle: oklch(96.7% 0.003 264.542)
  border: oklch(92.8% 0.006 264.531)
  ink: oklch(21% 0.034 264.665)
  text: oklch(37.3% 0.034 259.733)
  muted: oklch(55.1% 0.027 264.364)
  quiet: oklch(70.7% 0.022 261.325)
  success-soft: oklch(96.2% 0.044 156.743)
  success: oklch(52.7% 0.154 150.069)
  recruiting-soft: oklch(95.4% 0.038 75.164)
  recruiting: oklch(64.6% 0.222 41.116)
  scheduled-soft: oklch(94.3% 0.029 294.588)
  scheduled: oklch(49.1% 0.27 292.581)
  waiting-soft: oklch(95.1% 0.026 236.824)
  waiting: oklch(50% 0.134 242.749)
  active-soft: oklch(93.2% 0.032 255.585)
  danger: oklch(57.7% 0.245 27.325)
  danger-hover: oklch(50.5% 0.213 27.518)
  surface: '#ffffff'
  control-text: oklch(44.6% 0.03 256.802)
typography:
  headline:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.015em
  title:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.015em
  section:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0.015em
  body:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: '''EvalHub Noto Sans KR'', ''Noto Sans KR'', -apple-system, BlinkMacSystemFont, ''Malgun Gothic'', system-ui, sans-serif'
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.333333
rounded:
  md: 6px
  control: 8px
  card: 12px
  dialog: 16px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 8px 16px
    height: 44px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.control-text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 8px 16px
    height: 44px
  button-danger:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 8px 16px
    height: 44px
  button-danger-hover:
    backgroundColor: '{colors.danger-hover}'
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.control-text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 8px 16px
    height: 44px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: 10px 14px
    height: 44px
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.card}'
    padding: 20px
  nav-active:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.primary-hover}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: 8px 10px
    height: 44px
  chip-active:
    backgroundColor: '{colors.active-soft}'
    textColor: '{colors.primary-hover}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 2px 8px
---

# Design System: EvalHub

## Overview

**Creative North Star: "차분한 심사 기록부"**

자료·지원서·평가 결과를 흰 기록면에 정리하고 선명한 업무 블루로 현재 위치와 주요 행동을 드러낸다. 친숙하고 부드러우며 안내가 분명한 업무 화면이다. 사용자가 승인한 매니저 프로그램 화면의 한글 글꼴과 조작부 원칙을 공통 표준으로 확장한다.

흰 카드와 회색 바탕, 얇은 구획선, 읽기 편한 한글을 유지한다. 화면의 목적에 따라 목록·양식·자료 열람과 채점의 밀도는 달라진다. 모든 화면을 동일한 카드 배열로 만들지 않는다.

**Key Characteristics:**

- Noto Sans KR의 차분한 한글과 명확한 정보 위계
- 업무 블루·흰 기록면·의미를 보존하는 상태색
- 넉넉한 입력·클릭 영역과 역할별 반응형 탐색
- 본문은 얇은 경계, 메뉴·대화상자는 필요한 깊이

기준 구현은 `frontend/src/styles/ui.css`와 `frontend/src/components/ui.jsx`다. 앞부분 토큰이 규범이며, 이 문서는 실제 구현의 역할과 예외를 설명한다.

## Colors

### Primary

**선명한 업무 블루**는 생성·저장·제출과 선택된 위치에 사용한다. 옅은 파랑은 선택·안내 면, 짙은 파랑은 그 면의 글자와 호버에 쓴다. 포커스는 공통 UI의 primary를 사용하며 기존 일부 조작부에는 focus 토큰 음영이 남아 있다.

### Neutral

**차분한 회색 바탕** 위에 **흰 기록면**을 놓고 옅은 경계로 그룹을 구분한다. ink는 제목·핵심 자료, text는 본문, control-text는 공통 보조 조작부와 설명, muted는 부가 정보에 쓴다. quiet는 낮은 우선순위의 작은 정보에 한정한다.

### Semantic states

프로그램의 임시 저장은 회색, 접수 예정은 보라, 지원 접수는 주황, 평가 대기는 하늘색, 평가 진행은 파랑, 완료는 초록이다. 삭제·오류는 빨강이다. 심사 배정의 대기 추가는 호박색, 대기 해제는 빨강으로 표시하며 확정 상태와 구별한다. 화면별 기존 상태 음영을 유지한다.

**The State Label Rule.** 색과 상태 이름·기호를 함께 사용한다. 공통 UI를 적용하면서 업무 상태나 권한 의미를 바꾸지 않는다.

## Typography

단일 기본 글꼴은 자체 호스팅한 **Noto Sans KR Variable**이다. 전역 family는 앞부분 토큰을 따른다. 별도의 장식용 디스플레이 글꼴은 없다. 표·기간·점수는 비교가 필요한 곳에 고정폭 숫자를 사용한다.

- **Headline:** 페이지 제목. headline 역할을 따른다.
- **Title / Section:** 카드·섹션 제목. title과 section 역할을 따른다.
- **Body:** 설명과 입력. 본문 기준이며 페이지 설명은 최대 65ch로 제한한다.
- **Label:** 버튼·탐색·메타데이터. 조밀한 업무 역할이다.
- **Caption:** 표 머리·상태·작은 부가 정보의 조밀한 예외다. 본문과 입력을 이 크기로 축소하지 않는다.

제목과 굵은 강조의 자간은 양의 title tracking을 따른다. 기존 페이지의 크기 유틸리티가 일부 역할을 조정하지만 공통 입력은 본문 크기를 유지한다. 제목은 balance, 문단은 pretty 줄바꿈을 사용하며 한글 어절을 우선하고 긴 문자열은 넘치지 않게 줄바꿈한다.

**The One Family Rule.** 새 화면도 공통 family와 역할을 재사용한다. 브라우저 확대와 텍스트 크기 설정을 막지 않는다.

글꼴은 Google Fonts 공식 `ofl/notosanskr`, commit `b38c5c93af322c45f633e17ac440ec1e6c94d489`에서 가져왔다. SIL OFL 1.1 원문은 `frontend/public/fonts/noto-sans-kr/OFL.txt`에 있다. 동일 TTF를 WOFF2로 무손실 압축한 파일을 `font-display: swap`으로 제공한다. 글리프를 생략한 서브셋이 아니며 variable weight 축은 100–900이다. 기본 업무 위계는 보통 400·500·600을 쓴다.

## Layout

공통 페이지는 중앙 정렬된 최대 폭 1440px, 좁은 양식은 최대 896px다. 바깥 좌우 여백은 데스크톱 24px, 모바일 16px이며 주요 구획 간격은 20px에서 모바일 16px로 줄어든다. 카드 안쪽은 20px, 모바일 16px다. 간격은 4px 단위 척도를 기본으로 한다.

매니저와 심사위원은 넓은 화면에서 224px 사이드바를 사용한다. 768px 미만에서는 상단 메뉴 버튼으로 탐색을 펼치고 본문 폭을 확보한다. 지원자는 상단 탐색을 유지하고 모바일에서 기관·계정 행 아래에 세 항목 탐색을 배치한다. 고정 사이드바를 모바일 표준으로 요구하지 않는다.

목록 카드는 가용 폭에 따라 열 수를 바꾸고, 양식·팀 상세·평가 자료와 점수 패널은 해당 업무에 맞춰 좁은 화면에서 세로로 재배치한다. 프로그램 목록의 카드 그리드와 기간 구획은 컨테이너 폭을 사용한다. 넓은 표와 배정 행렬은 자신의 스크롤 컨테이너 안에서 가로로 스크롤한다. 페이지 전체의 가로 넘침으로 대체하지 않는다. 상태 탭은 한 줄 가로 스크롤을 허용한다.

## Elevation & Depth

본문 카드는 얇은 경계와 배경 차이로 구분한다. 일부 프로그램 카드의 호버에는 md, 필터·계정 팝업에는 lg, 확인 대화상자에는 xl 또는 2xl 그림자를 사용한다. 실제 그림자 값은 sidecar의 extensions에 기록한다.

**The Contextual Depth Rule.** 메뉴·대화상자의 깊이를 일반 카드에 일괄 적용하지 않는다. 공통 조작부의 짧은 색상 전환은 reduced-motion 설정에서 제거한다.

## Shapes

입력·버튼은 부드러운 control 모서리, 카드는 card 모서리, 대화상자는 dialog 모서리를 쓴다. 알약 형태는 상태 배지와 작은 선택 표시 등에 사용한다. 기본 경계는 얇은 1px이며 상태색은 기존 업무 의미를 따른다.

조작부의 기본 최소 높이는 44px다. 체크 표시나 스위치의 작은 시각적 표식은 충분한 외부 클릭 영역 안에 둔다. 프로그램 생성 스위치와 심사 배정 셀은 24px 표식을 44px 대상 안에 배치한다.

## Components

### Buttons

`Button`은 secondary가 기본이며 primary·danger·ghost 변형을 제공한다. 최소 높이, 글꼴, 모서리, 포커스를 공유한다. 기본 type은 button이므로 양식 제출은 `type="submit"`을 지정한다. 기존 상태별 색상·비활성 유틸리티는 공통 component layer 위에서 유지한다.

### Inputs / Fields

`Input`, `TextArea`, `Select`는 본문 크기와 최소 높이를 공유한다. 포커스는 primary 경계와 외곽선, 비활성은 회색 면, aria-invalid는 빨간 경계다. `FieldInput`이 질문 유형별 기존 입력·선택 동작을 보존한다. `DateTimeInput`의 날짜·시·분과 팝업은 기존 검증·키보드 처리를 유지하며 읽기 크기와 대상 크기를 공유한다.

### Cards / Containers

`Card` 또는 같은 의미의 ui-card는 흰 면·얇은 경계·공통 안쪽 간격을 제공한다. `PageHeader`는 경로·제목·설명·행동을 묶고 가용 폭이 줄면 행동을 다음 행으로 보낸다. 카드 전체 클릭 동작이나 업무 구획의 의미는 호출 화면이 정한다.

### Chips / Navigation / Tables

상태 배지는 업무 상태색과 텍스트를 유지한다. 선택된 탐색은 옅은 파랑과 진한 파랑 글자다. 역할별 탐색 항목·권한을 공통 스타일로 바꾸지 않는다. `TableScroll`은 표의 가로 스크롤을 내부에 제한하고 고정폭 숫자를 지원한다. 탭은 선택 상태와 키보드 접근을 유지하며 한 줄 스크롤한다.

## Do's and Don'ts

### Do:

- Do 공통 글꼴·페이지 위계·입력·버튼·카드를 먼저 재사용한다.
- Do 업무 상태 이름, 권한, API·검증·저장 동작을 보존한다.
- Do 긴 한글 제목·이메일·기간과 좁은 화면에서 줄바꿈과 내부 스크롤을 확인한다.
- Do 눈에 보이는 포커스와 충분한 클릭 영역을 유지한다.

### Don't:

- Don't 새 화면마다 기본 글꼴·색·모서리·간격 체계를 다시 선언한다.
- Don't 상태색을 단일 브랜드색으로 통합한다.
- Don't 작은 아이콘에 일반 버튼 패딩을 그대로 더해 기호를 눌러 없앤다.
- Don't 데스크톱 열 구성을 모바일에 고정하거나 넓은 표 때문에 페이지 전체를 넘치게 한다.
