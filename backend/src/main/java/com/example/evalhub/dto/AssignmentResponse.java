package com.example.evalhub.dto;

import com.example.evalhub.entity.AssignmentStatus;
import com.example.evalhub.entity.EvaluationAssignment;

public record AssignmentResponse(
        Long id,
        Long programId,
        Long evaluatorId,
        String evaluatorEmail,
        AssignmentStatus status,
        String evaluatorName,
        boolean evaluatorDeleted
) {

    public static AssignmentResponse from(EvaluationAssignment assignment) {
        return new AssignmentResponse(
                assignment.getId(),
                assignment.getProgram().getId(),
                assignment.getEvaluator().getId(),
                assignment.getEvaluator().getDisplayEmail(),
                assignment.getStatus(),
                assignment.getEvaluator().getDisplayName(),
                assignment.getEvaluator().isDeleted()
        );
    }
}
