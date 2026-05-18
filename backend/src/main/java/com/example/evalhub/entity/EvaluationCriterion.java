package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "evaluation_criteria")
@Getter
@NoArgsConstructor
public class EvaluationCriterion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EvaluationScaleType scaleType = EvaluationScaleType.SCORE;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal maxScore = BigDecimal.TEN;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal weight;

    @Column(nullable = false)
    private Integer displayOrder;
}
