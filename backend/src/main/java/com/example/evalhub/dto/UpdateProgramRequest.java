package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.ProgramType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record UpdateProgramRequest(
        String title,
        String description,
        ProgramType type,
        Long managerId,
        LocalDate applicationStart,
        LocalDate applicationDeadline,
        LocalDate evaluationStart,
        LocalDate evaluationDeadline,
        String eligibilityCriteria,
        Boolean attachmentsEnabled,
        Integer maxAttachments,
        ParticipantType participantType,
        Boolean bonusEnabled,
        BigDecimal maxBonus,
        OffsetDateTime applicationStartAt,
        OffsetDateTime applicationDeadlineAt,
        OffsetDateTime evaluationStartAt,
        OffsetDateTime evaluationDeadlineAt
) {
    public UpdateProgramRequest(String title, String description, ProgramType type, Long managerId, LocalDate applicationStart, LocalDate applicationDeadline, LocalDate evaluationStart, LocalDate evaluationDeadline, String eligibilityCriteria, Boolean attachmentsEnabled, Integer maxAttachments, ParticipantType participantType, Boolean bonusEnabled, BigDecimal maxBonus) {
        this(title, description, type, managerId, applicationStart, applicationDeadline, evaluationStart, evaluationDeadline, eligibilityCriteria, attachmentsEnabled, maxAttachments, participantType, bonusEnabled, maxBonus, null, null, null, null);
    }
}
