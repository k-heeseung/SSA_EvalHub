package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.ProgramType;
import com.example.evalhub.entity.Status;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateProgramRequest(
        Long managerId,
        String title,
        String description,
        ProgramType type,
        Status status,
        LocalDate applicationStart,
        LocalDate applicationDeadline,
        LocalDate evaluationStart,
        LocalDate evaluationDeadline,
        String eligibilityCriteria,
        Boolean attachmentsEnabled,
        Integer maxAttachments,
        ParticipantType participantType,
        Boolean bonusEnabled,
        BigDecimal maxBonus
) {
}
