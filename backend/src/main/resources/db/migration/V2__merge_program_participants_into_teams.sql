-- Step 1: Add participant fields to teams
alter table teams add column display_name varchar(255);
alter table teams add column submission_url text;
alter table teams add column notes text;

-- Step 2: Populate from program_participants
update teams t
set display_name  = pp.display_name,
    submission_url = pp.submission_url,
    notes         = pp.notes
from program_participants pp
where pp.team_id = t.id;

update teams set display_name = name where display_name is null;
alter table teams alter column display_name set not null;

-- Step 3: Migrate evaluation_assignments.participant_id -> team_id
alter table evaluation_assignments add column team_id_new bigint;

update evaluation_assignments ea
set team_id_new = pp.team_id
from program_participants pp
where ea.participant_id = pp.id;

alter table evaluation_assignments
    drop constraint evaluation_assignments_participant_id_fkey,
    drop constraint evaluation_assignments_participant_id_evaluator_id_key,
    drop column participant_id;

alter table evaluation_assignments rename column team_id_new to team_id;
alter table evaluation_assignments alter column team_id set not null;
alter table evaluation_assignments
    add constraint evaluation_assignments_team_id_fkey
        foreign key (team_id) references teams (id) on delete cascade,
    add constraint evaluation_assignments_team_id_evaluator_id_key
        unique (team_id, evaluator_id);

-- Step 4: Migrate participant_attachments.participant_id -> team_id
alter table participant_attachments add column team_id_new bigint;

update participant_attachments pa
set team_id_new = pp.team_id
from program_participants pp
where pa.participant_id = pp.id;

alter table participant_attachments
    drop constraint participant_attachments_participant_id_fkey,
    drop column participant_id;

alter table participant_attachments rename column team_id_new to team_id;
alter table participant_attachments alter column team_id set not null;
alter table participant_attachments
    add constraint participant_attachments_team_id_fkey
        foreign key (team_id) references teams (id) on delete cascade;

-- Step 5: Drop program_participants
drop table program_participants;

-- Step 6: Update indexes
drop index if exists idx_program_participants_program_id;
create index if not exists idx_participant_attachments_team_id on participant_attachments (team_id);
