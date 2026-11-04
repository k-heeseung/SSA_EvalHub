-- Canonical instants; keep date columns while the existing frontend is migrated.
alter table programs add column application_start_at timestamp with time zone;
alter table programs add column application_deadline_at timestamp with time zone;
alter table programs add column evaluation_start_at timestamp with time zone;
alter table programs add column evaluation_deadline_at timestamp with time zone;

update programs set
    application_start_at = application_start::timestamp at time zone 'Asia/Seoul',
    application_deadline_at = (application_deadline + 1)::timestamp at time zone 'Asia/Seoul',
    evaluation_start_at = evaluation_start::timestamp at time zone 'Asia/Seoul',
    evaluation_deadline_at = (evaluation_deadline + 1)::timestamp at time zone 'Asia/Seoul';
