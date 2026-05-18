package com.example.evalhub.dto;

import java.util.List;

public record EvaluationViewResponse(
        AssignmentResponse assignment,
        ProgramResponse program,
        TeamResponse team,
        List<CriterionResponse> criteria,
        List<ParticipantAttachmentResponse> attachments,
        EvaluationSubmissionResponse submission
) {
}
