package com.example.evalhub.dto;

import com.example.evalhub.entity.Program;
import com.example.evalhub.entity.ProgramType;
import com.example.evalhub.entity.Status;

public record ProgramResponse(
        Long id,
        Long managerId,
        String title,
        String description,
        ProgramType type,
        Status status
) {

    public static ProgramResponse from(Program program) {
        return new ProgramResponse(
                program.getId(),
                program.getManager() == null ? null : program.getManager().getId(),
                program.getTitle(),
                program.getDescription(),
                program.getType(),
                program.getStatus()
        );
    }
}
