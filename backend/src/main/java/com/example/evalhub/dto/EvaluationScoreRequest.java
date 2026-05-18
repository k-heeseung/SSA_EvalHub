package com.example.evalhub.dto;

import java.math.BigDecimal;

public record EvaluationScoreRequest(
        Long criterionId,
        BigDecimal score
) {
}
