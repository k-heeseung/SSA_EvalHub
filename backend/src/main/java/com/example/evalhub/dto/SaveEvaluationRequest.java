package com.example.evalhub.dto;

import java.util.List;

public record SaveEvaluationRequest(
        String oneLineComment,
        List<EvaluationScoreRequest> scores
) {
}
