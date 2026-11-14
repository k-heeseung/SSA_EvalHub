alter table evaluation_assignments add column cancelled_at timestamp with time zone;
alter table evaluation_assignments drop constraint evaluation_assignments_program_id_evaluator_id_key;
create unique index uq_active_assignment_program_evaluator
    on evaluation_assignments(program_id, evaluator_id) where cancelled_at is null;
