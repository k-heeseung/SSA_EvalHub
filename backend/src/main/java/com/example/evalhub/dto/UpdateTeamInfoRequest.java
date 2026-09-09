package com.example.evalhub.dto;

import java.util.List;

// 팀 정보 탭에서 팀/본인 정보만 수정할 때 사용한다. 답변·첨부·제출 상태는 건드리지 않는다.
// 팀원 명단은 지원서 저장과 동일한 형식(SaveApplicationRequest.MemberInput)을 재사용한다.
public record UpdateTeamInfoRequest(
        String teamName,
        String participantName,
        String participantEmail,
        String participantPhone,
        List<SaveApplicationRequest.MemberInput> members
) {
}
