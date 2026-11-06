-- Keep legacy scalar/reason columns for history; all new reads/writes use item scores.
create table bonus_items (
    id bigserial primary key,
    program_id bigint not null references programs(id) on delete cascade,
    name varchar(255) not null,
    max_score numeric(10,2),
    display_order integer not null,
    constraint chk_bonus_item_max check (max_score is null or max_score >= 0)
);
create index idx_bonus_items_program on bonus_items(program_id);
create table team_bonus_scores (
    id bigserial primary key,
    team_id bigint not null references teams(id) on delete cascade,
    bonus_item_id bigint not null references bonus_items(id) on delete cascade,
    score numeric(10,2),
    unique (team_id, bonus_item_id),
    constraint chk_team_bonus_nonnegative check (score is null or score >= 0)
);
create index idx_team_bonus_item on team_bonus_scores(bonus_item_id);
insert into bonus_items(program_id, name, max_score, display_order)
select p.id, '가산점', p.max_bonus, 1 from programs p
where p.bonus_enabled or exists (select 1 from teams t where t.program_id = p.id and t.bonus_score is not null);
insert into team_bonus_scores(team_id, bonus_item_id, score)
select t.id, b.id, t.bonus_score from teams t join bonus_items b on b.program_id = t.program_id
where t.bonus_score is not null;
alter table programs add column evaluation_started boolean not null default false;
update programs p set evaluation_started = true where exists (
    select 1 from evaluation_submissions s join evaluation_assignments a on a.id = s.assignment_id
    where a.program_id = p.id
);

alter table programs alter column max_bonus type numeric(14,2);
