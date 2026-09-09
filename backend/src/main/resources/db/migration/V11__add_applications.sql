-- 지원자가 프로그램에 제출하는 지원서. 제출 대상 팀(teams)과 1:1로 연결된다.
create table if not exists applications (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    applicant_id bigint not null references users(id) on delete cascade,
    team_id bigint references teams(id) on delete set null,
    status varchar(20) not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED')),
    submitted_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    -- 한 지원자는 한 프로그램에 하나의 지원서만 가진다.
    constraint uq_applications_program_applicant unique (program_id, applicant_id)
);

create index if not exists idx_applications_applicant_id on applications(applicant_id);
create index if not exists idx_applications_program_id on applications(program_id);

-- 지원서의 양식 항목별 답변. 항목당 한 행.
create table if not exists application_answers (
    id bigserial primary key,
    application_id bigint not null references applications(id) on delete cascade,
    form_field_id bigint not null references application_form_fields(id) on delete cascade,
    value text,
    constraint uq_application_answers_field unique (application_id, form_field_id)
);

create index if not exists idx_application_answers_application_id on application_answers(application_id);
