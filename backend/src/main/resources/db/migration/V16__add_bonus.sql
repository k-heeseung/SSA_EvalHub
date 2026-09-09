-- 프로그램별 가산점(매니저 단독 평가) 설정
alter table programs add column if not exists bonus_enabled boolean not null default false;
alter table programs add column if not exists max_bonus numeric(6,2);

-- 팀별 가산점 값과 사유(선택)
alter table teams add column if not exists bonus_score numeric(6,2);
alter table teams add column if not exists bonus_reason text;
