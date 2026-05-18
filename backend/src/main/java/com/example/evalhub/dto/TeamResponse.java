package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.ProgramParticipant;
import com.example.evalhub.entity.Team;

public record TeamResponse(
        Long teamId,
        Long participantId,
        String name,
        ParticipantType participantType,
        String description
) {

    public static TeamResponse from(Team team, ProgramParticipant participant) {
        return new TeamResponse(
                team.getId(),
                participant.getId(),
                team.getName(),
                team.getParticipantType(),
                team.getDescription()
        );
    }
}
