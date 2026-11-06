# Program schedule API

## Requests

`POST /api/programs` and `PATCH /api/programs/{id}` accept these optional fields:

```json
{
  "applicationStartAt": "2030-11-10T09:00:00+09:00",
  "applicationDeadlineAt": "2030-11-20T18:00:00+09:00",
  "evaluationStartAt": "2030-11-20T18:00:00+09:00",
  "evaluationDeadlineAt": "2030-11-30T18:00:00+09:00"
}
```

An explicit UTC offset or `Z` is required. Values are stored as PostgreSQL
`timestamp with time zone` / Java `Instant`. Responses express them in `Asia/Seoul`.
Start is inclusive and deadline is exclusive: an 18:00 deadline blocks requests
at 18:00. Application start must precede its deadline; evaluation start must be
at or after application deadline and before evaluation deadline.

PATCH omits/nulls fields to preserve them. A supplied `*At` value takes precedence
over its legacy date. Unchanged legacy dates do not reset existing precise times.
Changing a legacy start date means 00:00; changing a legacy deadline means 00:00
of the following day, both interpreted in `Asia/Seoul`.

Legacy `applicationStart`, `applicationDeadline`, `evaluationStart` and
`evaluationDeadline` date fields remain during the frontend transition. The old
API constructors are retained for Java callers. Existing overlapping date-only
schedules are preserved by migration; edits that change a schedule must satisfy
the new instant ordering rules. Metadata-only edits remain possible.

## Responses

Program, application detail/summary and evaluator assignment responses include
`schedule`:

```json
{
  "applicationStartAt": "2030-11-10T09:00:00+09:00",
  "applicationDeadlineAt": "2030-11-20T18:00:00+09:00",
  "evaluationStartAt": "2030-11-20T18:00:00+09:00",
  "evaluationDeadlineAt": "2030-11-30T18:00:00+09:00",
  "serverNow": "2030-11-20T18:00:00+09:00",
  "periodStatus": "ACTIVE",
  "canApply": false,
  "canEditApplication": false,
  "canCancelApplication": false,
  "canEvaluate": true
}
```

Availability describes period rules, not authorization, required answers or file
limits. Authentication, ownership and submission validation still apply.
`canApply` also requires publication (not DRAFT or manually INACTIVE).
Managers retain their existing application/attachment edit exceptions.
These values are a snapshot; every write request checks the current instant again.
Public program listing excludes expired application periods even between scheduler runs.
Frontend follow-up should use `schedule` for exact displays and button states;
no timezone label is required in the UI.

## Migration

V19 adds canonical `*_at` columns, backfilling old starts at 00:00 of their dates
and deadlines at 00:00 of the next day in `Asia/Seoul`. Null dates remain null.
The old date columns are retained. Existing attachment and evaluation save rules
now compare instants rather than server-local dates.

## Evaluator screens and status synchronization

Evaluator screens display both dates and times from `schedule`. They use
`serverNow` plus time elapsed since the query response to check the inclusive
start and exclusive deadline, including submitted-evaluation edits. Pending
autosaves are cancelled at the deadline. The API remains the final authority
for requests that cross the deadline while in flight. Background refreshes
update the schedule without replacing locally edited scores or comments.

The status scheduler runs at startup and 30 seconds after each completed run.
It publishes an SSE change event only when statuses changed, after the service
transaction commits. Drafts and manually inactive programs stay unchanged.
Stored statuses may lag the period boundary by up to one interval; write
validation and response period calculations use the current instant directly.

## Tests

### Applicant request admission and batch attachments

Applicant start/save/submit/team edits, cancellation, and attachment writes use
the server timestamp captured by `RequestTimeFilter` at entry to the HTTP filter
chain, before body parsing and database work. A request admitted before the
deadline may finish after it. A browser click before the deadline does not admit
a request that reaches the server after it. No client-provided timestamp is trusted.
Response `schedule.serverNow` and availability flags still describe response time;
a successful admitted write can therefore return `canEditApplication: false`.

Open applicant editors keep their editable state across clock ticks and background
refreshes. Save/submit/edit/upload/delete actions check the period before sending;
an expired action is not sent and opens a deadline dialog. Its Confirm button
returns to the applicant home; no notice is left on the home page. A server
deadline rejection follows the same route. The attempted changes
are discarded, while previously saved/submitted data remains unchanged. Other
validation/network errors keep the editor open. Home/list/read-only screens retain
live indicators.

`POST /api/teams/{teamId}/attachments/batch` accepts repeated multipart `files`
parts in one request and returns `{ uploaded: ParticipantAttachmentResponse[],
failed: [{name, reason}] }`. It checks period and total capacity once, while holding
the existing team upload lock, then processes every selected file without clock
rechecks. Invalid files are reported individually. Attachment-disabled programs
and batches larger than remaining capacity are rejected before storing any file,
including manager-created teams. The existing single-file endpoint is retained.

Per-file size remains 20 MB. Multipart request size defaults to 200 MB and can be
configured with `EVALHUB_MAX_UPLOAD_REQUEST_SIZE` to accommodate combined files.

```powershell
.\gradlew.bat test --tests '*ProgramSchedule*' --tests '*ProgramInstantEnforcementTests'
```

Migration tests create and remove only their own unique PostgreSQL schema; the
normal application schema is not cleaned. Application integration fixtures roll back.
