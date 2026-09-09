package com.example.evalhub.dto;

import com.example.evalhub.entity.Team;
import com.example.evalhub.util.PhoneNumbers;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

// 지원자가 입력한 본인/팀원 정보. teams.applicant_info 컬럼에 JSON으로 저장한다.
// name/email/phone: 지원자 본인(팀 지원 시 팀장). members: 팀 지원 시 추가 팀원 명단.
// 전화번호는 모두 숫자만 남긴 정규화 형태로 저장하고, 화면 표시용 하이픈은 프론트에서 붙인다.
@JsonIgnoreProperties(ignoreUnknown = true)
public record ApplicantInfo(
        String name,
        String email,
        String phone,
        List<Member> members
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Member(String name, String email, String phone) {
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ApplicantInfo empty() {
        return new ApplicantInfo(null, null, null, List.of());
    }

    // JSON 텍스트 → 객체. 값이 없거나 파싱 실패 시 빈 정보를 반환한다.
    // 예전 데이터에는 팀원 phone이 없으므로 null로 들어온다.
    public static ApplicantInfo parse(String json) {
        if (json == null || json.isBlank()) return empty();
        try {
            ApplicantInfo info = MAPPER.readValue(json, ApplicantInfo.class);
            return new ApplicantInfo(
                    info.name(), info.email(), info.phone(),
                    info.members() == null ? List.of() : info.members()
            );
        } catch (Exception e) {
            return empty();
        }
    }

    // 팀에 저장된 지원자 정보를 읽는다. 대표 연락처는 전용 컬럼(participant_phone)을 기준으로 삼고,
    // 컬럼이 비어 있는 예전 데이터만 JSON 값으로 대체한다.
    public static ApplicantInfo of(Team team) {
        if (team == null) return empty();
        ApplicantInfo parsed = parse(team.getApplicantInfo());
        String phone = team.getParticipantPhone() != null ? team.getParticipantPhone() : parsed.phone();
        return parsed.withPhone(phone);
    }

    public ApplicantInfo withPhone(String phone) {
        return new ApplicantInfo(name, email, phone, members);
    }

    // 계정 생성/연결 여부와 무관하게 지원서에 적힌 팀장과 추가 팀원을 모두 센다.
    public int totalMemberCount() {
        return 1 + (members == null ? 0 : members.size());
    }

    // 대표 연락처 + 팀원 연락처를 정규화된 형태로 모은다. (중복 제거, 빈 값 제외)
    // 결과 안내 문자 발송 대상을 만들 때 사용한다.
    public List<String> allPhones() {
        return java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(phone),
                        (members == null ? List.<Member>of() : members).stream().map(Member::phone))
                .map(PhoneNumbers::normalizeOrNull)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
    }

    public String toJson() {
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            return null;
        }
    }
}
