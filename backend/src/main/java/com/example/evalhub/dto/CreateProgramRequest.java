package com.example.evalhub.dto;

import com.example.evalhub.entity.ProgramType;

public record CreateProgramRequest(
        Long managerId,
        String title,
        String description,
        ProgramType type
) {
}
