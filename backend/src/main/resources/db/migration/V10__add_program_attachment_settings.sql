-- 프로그램별 지원자 첨부파일 설정
alter table programs add column if not exists attachments_enabled boolean not null default false;
alter table programs add column if not exists max_attachments integer;
