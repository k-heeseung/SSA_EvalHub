package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "evaluation_assignments")
@Getter
@NoArgsConstructor
public class EvaluationAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_id", nullable = false)
    private User evaluator;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentStatus status = AssignmentStatus.ASSIGNED;

    public EvaluationAssignment(Program program, User evaluator) {
        this.program = program;
        this.evaluator = evaluator;
    }

    public void markInProgress() {
        if (this.status == AssignmentStatus.ASSIGNED) {
            this.status = AssignmentStatus.IN_PROGRESS;
        }
    }

    public void markSubmitted() {
        this.status = AssignmentStatus.SUBMITTED;
    }

    // 팀별 제출 현황에 따라 배정 상태를 다시 계산한다.
    // 모든 팀 제출 완료 → SUBMITTED, 일부라도 저장/제출 → IN_PROGRESS, 아무 활동 없음 → ASSIGNED
    public void updateProgress(boolean allTeamsSubmitted, boolean anyActivity) {
        if (allTeamsSubmitted) {
            this.status = AssignmentStatus.SUBMITTED;
        } else if (anyActivity) {
            this.status = AssignmentStatus.IN_PROGRESS;
        } else {
            this.status = AssignmentStatus.ASSIGNED;
        }
    }
}
