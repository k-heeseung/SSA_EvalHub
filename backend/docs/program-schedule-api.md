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
now compare instants rather than server-local dates. Scheduler frequency and
frontend input/display changes are separate follow-up work.

## Tests

```powershell
.\gradlew.bat test --tests '*ProgramSchedule*' --tests '*ProgramInstantEnforcementTests'
```

Migration tests create and remove only their own unique PostgreSQL schema; the
normal application schema is not cleaned. Application integration fixtures roll back.
