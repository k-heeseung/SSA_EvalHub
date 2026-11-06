package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.Team;
import com.example.evalhub.entity.TeamStatus;

import java.math.BigDecimal;
import java.util.List;

public record TeamResponse(
        Long teamId,
        String name,
        ParticipantType participantType,
        String description,
        TeamStatus status,
        String displayName,
        String submissionUrl,
        String notes,
        ApplicantInfo applicantInfo,
        BigDecimal bonusScore,
        List<BonusScoreResponse> bonusScores,
        int memberCount,
        long attachmentCount,
        List<TeamMemberResponse> members
) {

    public static TeamResponse from(Team team, List<TeamMemberResponse> members) {
        return from(team, members, 0);
    }

    public static TeamResponse from(Team team, List<TeamMemberResponse> members, long attachmentCount) {
        ApplicantInfo applicantInfo = ApplicantInfo.of(team);
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getParticipantType(),
                team.getDescription(),
                team.getStatus(),
                team.getDisplayName(),
                team.getSubmissionUrl(),
                team.getNotes(),
                applicantInfo,
                team.getBonusScore(),
                BonusScoreResponse.from(team),
                applicantInfo.totalMemberCount(),
                attachmentCount,
                members
        );
    }
}
