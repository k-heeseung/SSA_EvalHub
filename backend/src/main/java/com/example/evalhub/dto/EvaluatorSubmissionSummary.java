package com.example.evalhub.dto;

public record EvaluatorSubmissionSummary(
        Long evaluatorId,
        String evaluatorEmail,
        String evaluatorName,
        EvaluationSubmissionResponse submission
) {
}
