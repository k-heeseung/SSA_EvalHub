package com.example.evalhub.dto;

import com.example.evalhub.entity.TeamStatus;

public record ChangeTeamStatusRequest(
        TeamStatus status
) {
}
