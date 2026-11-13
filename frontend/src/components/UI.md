# Shared UI

Use `src/styles/ui.css` for visual tokens and `src/components/ui.jsx` for primitives. `DESIGN.md` is the portable visual contract. Keep API calls, validation, permissions, persistence and business statuses in domain code.

## Primitives

```jsx
import { Button, Input, TextArea, Select, Card, TableScroll } from './ui';

<Card><h2>팀 정보</h2><Input aria-label="팀명" value={name} onChange={onNameChange} /></Card>
<Button variant="primary" type="submit" disabled={saving}>저장</Button>
<TableScroll><table>{/* existing columns, rows and handlers */}</table></TableScroll>
```

| Primitive | Contract |
| --- | --- |
| Button | `variant`: secondary (default), primary, danger, ghost. Default `type="button"`; set submit explicitly. Other native props pass through. |
| Input / TextArea / Select | Native props pass through. 16px text, minimum 44px target, shared focus/disabled/error styles. Supply accessible labels and existing validation. |
| Card | Renders section; caller supplies heading/meaning. White surface, thin border, 12px radius; 20px padding, 16px mobile. |
| TableScroll | A div with contained horizontal scroll. Keep table semantics; assign domain-appropriate minimum table width. |

## Page composition

Manager program details use one `program-detail-header`: a 28px program title with lifecycle status, 14px type/eligibility context, a two-column application/evaluation schedule with 16px date values, and a compact metrics row. Neutral outline actions form a separate group and wrap on small screens; the status disclosure stays outside clipped containers and supports Escape/focus return. `ProgramDetailPage.css` owns these scoped styles. Preserve existing metric calculations, route handlers and tab content when refining this header.

Program detail work groups use 지원 팀 / 평가 기준 / 심사위원 배정 / 평가 결과 consistently. Team filters map directly to ALL / PENDING / IN_PROGRESS / COMPLETE and wrap within the toolbar rather than hiding a state behind horizontal scrolling. Selection is exposed with aria-pressed. Evaluation-criterion numbering uses 기준 N rather than question labels; a filtered empty result is distinguished from an unregistered team list.

Applicant team information uses a team/supporter name as the card title, with the program and application period as supporting text. `TeamMemberList variant="profile"` presents each person's full name above labeled email/phone data and separates people with quiet dividers; long names wrap. This opt-in variant is scoped to applicant team information. Other consumers keep the default aligned-column layout. Page-specific spacing lives in `ApplicantTeamPage.css`; shared profile styles live in `TeamMemberList.css`.

Applicant home uses the approved program-browser layout in `ApplicantHomePage.css`: a short heading, one compact draft/submitted summary with an application-list link, and recruitment/upcoming tabs above the same card grid. Cards use a 3/2/1-column layout, matching title/body roles and bottom-aligned schedules; the whole card links to its program detail. Tabs support arrow keys and Home/End with linked tab panels. Recruitment tabs include every program in the corresponding application period, including already-started or submitted applications; cards show personal status and the detail page opens the existing application. Missing query results never become confirmed zero counts. Independent retries and the detail-page creation guard remain. Detailed personal progress belongs on the existing application-list page.

Use `ui-page`, optionally `ui-page--narrow` (896px) or `ui-page--wide` (no maximum). Default maximum is 1440px. Shared gutters are 24px desktop and 16px below 768px. Use `PageHeader` for breadcrumb, title, description and wrapping actions; avoid creating another page-heading system. `ui-tabs` keeps status choices in one scrollable row.

`FieldInput` remains the question-type adapter; its text controls use Input/TextArea while checkbox/radio behavior stays native. `DateTimeInput` keeps its date/time validation and keyboard interaction. Use it rather than reimplementing scheduling fields.

Manager and evaluator shells collapse navigation below 768px; applicant navigation reflows below the identity/account row. Keep these shell decisions out of individual forms. Split viewers and scoring workspaces retain page-specific responsive structure.

## Cascade and roles

Common primitive defaults live in the components layer, so Tailwind state/color/width utilities can override them. Shared page title, description, input text size, tracking and mobile card padding have explicit final rules. Preserve domain status colors and disabled states when adding semantic classes.

Noto Sans KR is loaded once by ui.css from `/fonts/noto-sans-kr/NotoSansKR-Variable.woff2` with swap. Do not add page-local font downloads. Page/title/body/label roles are 28/20/16/14px; 12px is retained for dense captions. Titles use 600 and +0.015em tracking. Dates, scores and comparable columns use tabular numbers.

For icon buttons, switches and assignment cells, use a 44px outer target with `p-0` and a separate inner visual. Fixed `h-6` does not cancel a button's 44px min-height; a tiny `w-6` with normal button padding can collapse its icon. Keep inner SVG `shrink-0`. Avoid attaching text-input styles to checkbox/radio/file inputs.

Verify long titles, dates, email, loading/error/empty states and narrow containers. Reuse existing handlers; a visual migration does not authorize changing data or workflow semantics.

Applicant program cards link to `/applicant/programs/:programId` and never create applications. `ApplicantProgramInfo` displays the full introduction and eligibility criteria on that detail page, preserving paragraph breaks, wrapping long text, and showing explicit missing-data messages. The detail page groups dates, existing application status and the explicit draft-creation action in a separate support area; mobile stacks it after the introduction with a jump link. `ApplicantQueryNotice` keeps independent query failures and retries visible. New application creation stays disabled until program and application queries succeed and the application period is open.
