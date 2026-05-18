package com.example.evalhub.dto;

import com.example.evalhub.entity.EvaluationSubmission;
import com.example.evalhub.entity.SubmissionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record EvaluationSubmissionResponse(
        Long id,
        SubmissionStatus status,
        BigDecimal totalScore,
        String oneLineComment,
        LocalDateTime submittedAt,
        List<EvaluationScoreResponse> scores
) {

    public static EvaluationSubmissionResponse from(
            EvaluationSubmission submission,
            List<EvaluationScoreResponse> scores
    ) {
        return new EvaluationSubmissionResponse(
                submission.getId(),
                submission.getStatus(),
                submission.getTotalScore(),
                submission.getOneLineComment(),
                submission.getSubmittedAt(),
                scores
        );
    }
}
