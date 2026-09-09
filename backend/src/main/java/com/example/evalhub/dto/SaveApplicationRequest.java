package com.example.evalhub.dto;

import java.util.List;

// 임시저장 / 제출 시 지원서 전체 내용을 전송한다. answers는 화면에 표시된 전체 항목을 그대로 보낸다.
public record SaveApplicationRequest(
        String teamName,
        String participantName,
        String participantEmail,
        String participantPhone,
        List<MemberInput> members,
        List<AnswerInput> answers
) {

    public record AnswerInput(
            Long formFieldId,
            String value
    ) {
    }

    public record MemberInput(
            String name,
            String email,
            String phone
    ) {
    }
}
