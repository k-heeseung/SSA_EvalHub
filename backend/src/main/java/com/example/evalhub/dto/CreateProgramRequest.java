package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.ProgramType;
import com.example.evalhub.entity.Status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

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
        BigDecimal maxBonus,
        OffsetDateTime applicationStartAt,
        OffsetDateTime applicationDeadlineAt,
        OffsetDateTime evaluationStartAt,
        OffsetDateTime evaluationDeadlineAt
) {
    public CreateProgramRequest(Long managerId, String title, String description, ProgramType type, Status status, LocalDate applicationStart, LocalDate applicationDeadline, LocalDate evaluationStart, LocalDate evaluationDeadline, String eligibilityCriteria, Boolean attachmentsEnabled, Integer maxAttachments, ParticipantType participantType, Boolean bonusEnabled, BigDecimal maxBonus) {
        this(managerId, title, description, type, status, applicationStart, applicationDeadline, evaluationStart, evaluationDeadline, eligibilityCriteria, attachmentsEnabled, maxAttachments, participantType, bonusEnabled, maxBonus, null, null, null, null);
    }
}
