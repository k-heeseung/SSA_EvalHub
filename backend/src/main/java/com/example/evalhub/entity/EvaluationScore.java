package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "evaluation_scores")
@Getter
@NoArgsConstructor
public class EvaluationScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    private EvaluationSubmission submission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criterion_id", nullable = false)
    private EvaluationCriterion criterion;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal score;

    public EvaluationScore(EvaluationSubmission submission, EvaluationCriterion criterion, BigDecimal score) {
        this.submission = submission;
        this.criterion = criterion;
        this.score = score;
    }

    public void updateScore(BigDecimal score) {
        this.score = score;
    }
}
