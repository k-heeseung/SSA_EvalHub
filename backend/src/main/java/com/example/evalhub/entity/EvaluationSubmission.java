package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "evaluation_submissions")
@Getter
@NoArgsConstructor
public class EvaluationSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id", nullable = false)
    private EvaluationAssignment assignment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubmissionStatus status = SubmissionStatus.DRAFT;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalScore = BigDecimal.ZERO;

    @Column(name = "one_line_comment", length = 500)
    private String oneLineComment;

    private LocalDateTime submittedAt;

    public EvaluationSubmission(EvaluationAssignment assignment) {
        this.assignment = assignment;
    }

    public void saveDraft(BigDecimal totalScore, String oneLineComment) {
        this.status = SubmissionStatus.DRAFT;
        this.totalScore = totalScore;
        this.oneLineComment = oneLineComment;
        this.submittedAt = null;
    }

    public void submit(BigDecimal totalScore, String oneLineComment) {
        this.status = SubmissionStatus.SUBMITTED;
        this.totalScore = totalScore;
        this.oneLineComment = oneLineComment;
        this.submittedAt = LocalDateTime.now();
    }
}
