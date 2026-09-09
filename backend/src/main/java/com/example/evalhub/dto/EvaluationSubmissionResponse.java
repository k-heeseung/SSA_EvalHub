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
        // 과거에 평균으로 저장된 제출도 세부 점수가 남아 있으면 항상 합계로 응답한다.
        BigDecimal totalScore = scores.stream()
                .map(EvaluationScoreResponse::score)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EvaluationSubmissionResponse(
                submission.getId(),
                submission.getStatus(),
                totalScore,
                submission.getOneLineComment(),
                submission.getSubmittedAt(),
                scores
        );
    }
}
