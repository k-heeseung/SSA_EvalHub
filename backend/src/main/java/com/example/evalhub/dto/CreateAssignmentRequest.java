package com.example.evalhub.dto;

public record CreateAssignmentRequest(
        Long participantId,
        Long evaluatorId
) {
}
