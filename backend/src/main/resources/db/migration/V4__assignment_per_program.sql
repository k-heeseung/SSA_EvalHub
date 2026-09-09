-- Step 1: Add team_id to evaluation_submissions before removing from assignments
alter table evaluation_submissions add column team_id bigint;

update evaluation_submissions es
set team_id = ea.team_id
from evaluation_assignments ea
where es.assignment_id = ea.id;

update evaluation_submissions set team_id = (select id from teams limit 1) where team_id is null;

alter table evaluation_submissions alter column team_id set not null;
alter table evaluation_submissions
    add constraint evaluation_submissions_team_id_fkey
        foreign key (team_id) references teams (id) on delete cascade;

-- Step 2: Change unique constraint on evaluation_submissions (assignment당 1개 → team당 1개)
alter table evaluation_submissions
    drop constraint evaluation_submissions_assignment_id_key;
alter table evaluation_submissions
    add constraint evaluation_submissions_assignment_id_team_id_key
        unique (assignment_id, team_id);

-- Step 3: Remove team_id from evaluation_assignments
alter table evaluation_assignments
    drop constraint evaluation_assignments_team_id_evaluator_id_key,
    drop constraint evaluation_assignments_team_id_fkey,
    drop column team_id;

-- Step 4: 같은 프로그램에 동일 평가자가 중복 배정된 경우 id가 낮은 행만 남긴다.
delete from evaluation_assignments ea
using evaluation_assignments ea2
where ea.program_id = ea2.program_id
  and ea.evaluator_id = ea2.evaluator_id
  and ea.id > ea2.id;

-- Step 5: Change unique constraint to (program_id, evaluator_id)
alter table evaluation_assignments
    add constraint evaluation_assignments_program_id_evaluator_id_key
        unique (program_id, evaluator_id);
