-- 프로그램 지원 시작일
alter table programs add column if not exists application_start date;

-- 프로그램 지원 양식 항목 (지원서에서 지원자가 채울 항목 정의)
create table if not exists application_form_fields (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    label varchar(255) not null,
    field_type varchar(50) not null,
    required boolean not null default false,
    display_order integer not null
);

create index if not exists idx_application_form_fields_program_id on application_form_fields(program_id);
