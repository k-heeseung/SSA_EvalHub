package com.example.evalhub.dto;

public record UpdateTeamRequest(
        String name,
        String description,
        String submissionUrl,
        String notes
) {
}
