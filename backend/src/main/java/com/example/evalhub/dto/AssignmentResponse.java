package com.example.evalhub.dto;

import com.example.evalhub.entity.AssignmentStatus;
import com.example.evalhub.entity.EvaluationAssignment;

public record AssignmentResponse(
        Long id,
        Long programId,
        Long participantId,
        String participantName,
        Long evaluatorId,
        String evaluatorEmail,
        AssignmentStatus status
) {

    public static AssignmentResponse from(EvaluationAssignment assignment) {
        return new AssignmentResponse(
                assignment.getId(),
                assignment.getProgram().getId(),
                assignment.getParticipant().getId(),
                assignment.getParticipant().getDisplayName(),
                assignment.getEvaluator().getId(),
                assignment.getEvaluator().getEmail(),
                assignment.getStatus()
        );
    }
}
