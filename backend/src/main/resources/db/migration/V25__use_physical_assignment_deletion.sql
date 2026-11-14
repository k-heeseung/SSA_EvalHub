-- V24 was applied during local verification before the deletion policy was finalized.
-- Keep applied migrations immutable and restore the physical-deletion schema forward.
drop index uq_active_assignment_program_evaluator;
alter table evaluation_assignments drop column cancelled_at;
alter table evaluation_assignments
    add constraint evaluation_assignments_program_id_evaluator_id_key unique (program_id, evaluator_id);
