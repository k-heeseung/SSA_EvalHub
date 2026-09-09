package com.example.evalhub.dto;

import java.math.BigDecimal;

public record UpdateCriterionRequest(
        String name,
        String description,
        BigDecimal weight,
        Integer displayOrder
) {
}
