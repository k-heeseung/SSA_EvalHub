package com.example.evalhub.dto;

import com.example.evalhub.entity.TeamStatus;

import java.math.BigDecimal;
import java.util.List;

public record TeamEvaluationResult(
        Long teamId,
        String teamName,
        TeamStatus teamStatus,
        BigDecimal bonusScore,
        List<EvaluatorSubmissionSummary> evaluations,
        List<BonusScoreResponse> bonusScores
) {
}
