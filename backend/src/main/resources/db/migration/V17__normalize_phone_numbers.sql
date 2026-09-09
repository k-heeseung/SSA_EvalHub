-- 전화번호는 숫자만 남긴 정규화 형태로 저장한다. 표시용 하이픈은 조회 시점에 붙인다.

-- 회원가입 화면에서 입력받지만 저장되지 않던 휴대폰 번호.
alter table users add column if not exists phone varchar(20);

-- 지원자 대표 연락처. applicant_info(JSON 텍스트) 안에만 있어서
-- 검색·중복 확인·발송 대상 조회가 불가능했으므로 전용 컬럼으로 분리한다.
alter table teams add column if not exists participant_phone varchar(20);

-- 기존 applicant_info에 들어있던 연락처를 새 컬럼으로 옮긴다.
-- applicant_info는 text 컬럼이라 깨진 JSON이 섞여 있을 수 있으므로
-- json 캐스팅 대신 정규식으로 추출하고, 숫자 외 문자는 모두 제거한다.
update teams
set participant_phone = regexp_replace(
        substring(applicant_info from '"phone"\s*:\s*"([^"]*)"'),
        '[^0-9]', '', 'g')
where participant_phone is null
  and applicant_info is not null
  and applicant_info ~ '"phone"\s*:\s*"[^"]+"';

-- 숫자가 하나도 없던 값은 빈 문자열이 되므로 null로 되돌린다.
update teams set participant_phone = null where participant_phone = '';

-- 중복 지원 확인과 지원자 검색에 사용한다.
create index if not exists idx_teams_participant_phone on teams (participant_phone);
