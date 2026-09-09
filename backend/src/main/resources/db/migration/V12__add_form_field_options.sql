-- 지원 양식 항목의 선택지(객관식/체크박스/드롭다운 유형). 줄바꿈으로 구분해 저장한다.
alter table application_form_fields add column if not exists options text;
