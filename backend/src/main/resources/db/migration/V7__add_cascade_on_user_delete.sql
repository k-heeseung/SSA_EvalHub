-- evaluator가 삭제될 때 배정 레코드도 함께 삭제
alter table evaluation_assignments drop constraint if exists evaluation_assignments_evaluator_id_fkey;
alter table evaluation_assignments
    add constraint evaluation_assignments_evaluator_id_fkey
    foreign key (evaluator_id) references users(id) on delete cascade;

-- 팀원이 삭제될 때 팀 멤버 레코드도 함께 삭제
alter table team_members drop constraint if exists team_members_member_id_fkey;
alter table team_members
    add constraint team_members_member_id_fkey
    foreign key (member_id) references users(id) on delete cascade;
