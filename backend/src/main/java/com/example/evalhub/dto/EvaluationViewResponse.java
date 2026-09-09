package com.example.evalhub.dto;

import java.util.List;

public record EvaluationViewResponse(
        ProgramResponse program,
        TeamResponse team,
        ApplicationDetailResponse application,
        List<CriterionResponse> criteria,
        List<ParticipantAttachmentResponse> attachments,
        EvaluationSubmissionResponse submission
) {
}
