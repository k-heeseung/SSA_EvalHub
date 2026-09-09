package com.example.evalhub.dto;

import com.example.evalhub.entity.TeamMember;

public record TeamMemberResponse(
        Long id,
        Long memberId,
        String email
) {

    public static TeamMemberResponse from(TeamMember teamMember) {
        return new TeamMemberResponse(
                teamMember.getId(),
                teamMember.getMember().getId(),
                teamMember.getMember().getEmail()
        );
    }
}
