-- 프로그램 지원 방식: 개인 지원(INDIVIDUAL) / 팀 지원(TEAM). 매니저가 프로그램마다 설정한다.
alter table programs add column if not exists participant_type varchar(20) not null default 'INDIVIDUAL';

-- 지원자가 입력한 본인/팀원 정보(이름·이메일·연락처, 팀원 명단). JSON 텍스트로 저장한다.
alter table teams add column if not exists applicant_info text;
