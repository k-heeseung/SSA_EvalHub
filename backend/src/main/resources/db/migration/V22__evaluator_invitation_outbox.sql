create table evaluator_invitations (
    id bigserial primary key,
    user_id bigint not null unique references users(id) on delete cascade,
    recipient_email varchar(255) not null,
    status varchar(24) not null check (status in ('PENDING','PROCESSING','RETRY_WAIT','SENT','FAILED','CANCELLED','EXPIRED')),
    encrypted_password text,
    attempt_count integer not null default 0,
    next_attempt_at timestamptz not null default current_timestamp,
    expires_at timestamptz not null,
    locked_until timestamptz,
    claim_token varchar(36),
    gmail_message_id varchar(255),
    last_error_code varchar(64),
    created_at timestamptz not null default current_timestamp,
    last_attempt_at timestamptz,
    sent_at timestamptz,
    password_deleted_at timestamptz
);
create index evaluator_invitations_due on evaluator_invitations(next_attempt_at)
    where status in ('PENDING','RETRY_WAIT','PROCESSING');
