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
    @JoinColumn(name = "participant_id", nullable = false)
    private ProgramParticipant participant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_id", nullable = false)
    private User evaluator;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentStatus status = AssignmentStatus.ASSIGNED;

    public EvaluationAssignment(Program program, ProgramParticipant participant, User evaluator) {
        this.program = program;
        this.participant = participant;
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
}
