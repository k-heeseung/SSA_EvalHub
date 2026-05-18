package com.example.evalhub.dto;

import com.example.evalhub.entity.EvaluationScore;

import java.math.BigDecimal;

public record EvaluationScoreResponse(
        Long criterionId,
        BigDecimal score
) {

    public static EvaluationScoreResponse from(EvaluationScore score) {
        return new EvaluationScoreResponse(score.getCriterion().getId(), score.getScore());
    }
}
