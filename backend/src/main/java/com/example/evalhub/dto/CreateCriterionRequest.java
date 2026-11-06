package com.example.evalhub.dto;

import java.math.BigDecimal;

public record CreateCriterionRequest(
        String name,
        String description,
        BigDecimal maxScore,
        Integer displayOrder
) {
}
