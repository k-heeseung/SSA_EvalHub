package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;

import java.util.List;

public record CreateTeamRequest(
        String name,
        ParticipantType participantType,
        String description,
        String submissionUrl,
        String notes,
        List<Long> memberIds
) {
}
