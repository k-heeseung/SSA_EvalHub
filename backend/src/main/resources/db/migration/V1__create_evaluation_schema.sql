create table if not exists users (
    id bigserial primary key,
    email varchar(255) not null unique,
    password varchar(255) not null,
    role varchar(50) not null,
    status varchar(50) not null default 'ACTIVE'
);

create table if not exists programs (
    id bigserial primary key,
    manager_id bigint references users(id),
    title varchar(255) not null,
    description text,
    type varchar(50) not null,
    status varchar(50) not null default 'ACTIVE'
);

alter table programs add column if not exists description text;
alter table programs add column if not exists status varchar(50) not null default 'ACTIVE';

create table if not exists teams (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    name varchar(255) not null,
    participant_type varchar(50) not null default 'TEAM',
    description text,
    unique (program_id, name)
);

alter table teams add column if not exists participant_type varchar(50) not null default 'TEAM';

create table if not exists team_members (
    id bigserial primary key,
    team_id bigint not null references teams(id) on delete cascade,
    member_id bigint not null references users(id),
    unique (team_id, member_id)
);

create table if not exists program_participants (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    team_id bigint not null references teams(id),
    display_name varchar(255) not null,
    submission_url text,
    notes text,
    unique (program_id, team_id)
);

create table if not exists participant_attachments (
    id bigserial primary key,
    participant_id bigint not null references program_participants(id) on delete cascade,
    original_filename varchar(255) not null,
    stored_filename varchar(255) not null,
    content_type varchar(100) not null,
    file_size bigint not null,
    storage_path varchar(1000) not null,
    uploaded_at timestamp not null,
    constraint chk_participant_attachments_pdf check (content_type = 'application/pdf')
);

create table if not exists evaluation_criteria (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    name varchar(255) not null,
    description text,
    scale_type varchar(50) not null default 'SCORE',
    max_score numeric(8, 2) not null default 10,
    weight numeric(8, 2) not null,
    display_order integer not null,
    constraint chk_evaluation_criteria_score_form check (
        scale_type = 'SCORE' and max_score = 10
    ),
    unique (program_id, display_order)
);

create table if not exists evaluation_assignments (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    participant_id bigint not null references program_participants(id) on delete cascade,
    evaluator_id bigint not null references users(id),
    status varchar(50) not null default 'ASSIGNED',
    unique (participant_id, evaluator_id)
);

create table if not exists evaluation_submissions (
    id bigserial primary key,
    assignment_id bigint not null unique references evaluation_assignments(id) on delete cascade,
    status varchar(50) not null default 'DRAFT',
    total_score numeric(10, 2) not null default 0,
    one_line_comment varchar(500),
    submitted_at timestamp,
    constraint chk_evaluation_submissions_comment_one_line check (
        one_line_comment is null
        or (
            position(chr(10) in one_line_comment) = 0
            and position(chr(13) in one_line_comment) = 0
        )
    )
);

create table if not exists evaluation_scores (
    id bigserial primary key,
    submission_id bigint not null references evaluation_submissions(id) on delete cascade,
    criterion_id bigint not null references evaluation_criteria(id) on delete cascade,
    score numeric(8, 2) not null,
    constraint chk_evaluation_scores_score_range check (score >= 0 and score <= 10),
    unique (submission_id, criterion_id)
);

create index if not exists idx_programs_manager_id on programs(manager_id);
create index if not exists idx_teams_program_id on teams(program_id);
create index if not exists idx_program_participants_program_id on program_participants(program_id);
create index if not exists idx_participant_attachments_participant_id on participant_attachments(participant_id);
create index if not exists idx_evaluation_criteria_program_id on evaluation_criteria(program_id);
create index if not exists idx_evaluation_assignments_program_id on evaluation_assignments(program_id);
create index if not exists idx_evaluation_assignments_evaluator_id on evaluation_assignments(evaluator_id);
create index if not exists idx_evaluation_scores_criterion_id on evaluation_scores(criterion_id);
