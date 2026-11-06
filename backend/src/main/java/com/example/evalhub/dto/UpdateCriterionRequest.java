package com.example.evalhub.dto;

import java.math.BigDecimal;

public record UpdateCriterionRequest(
        String name,
        String description,
        BigDecimal maxScore,
        Integer displayOrder
) {
}
