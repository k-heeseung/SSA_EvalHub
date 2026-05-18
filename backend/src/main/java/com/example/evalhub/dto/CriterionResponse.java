package com.example.evalhub.dto;

import com.example.evalhub.entity.EvaluationCriterion;

import java.math.BigDecimal;

public record CriterionResponse(
        Long id,
        String name,
        String description,
        BigDecimal maxScore,
        BigDecimal weight,
        Integer displayOrder
) {

    public static CriterionResponse from(EvaluationCriterion criterion) {
        return new CriterionResponse(
                criterion.getId(),
                criterion.getName(),
                criterion.getDescription(),
                criterion.getMaxScore(),
                criterion.getWeight(),
                criterion.getDisplayOrder()
        );
    }
}
