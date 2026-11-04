package com.example.evalhub.dto;

import com.example.evalhub.entity.Program;
import com.example.evalhub.entity.Status;
import com.example.evalhub.util.ProgramTimes;
import java.time.Instant;
import java.time.OffsetDateTime;

// Availability describes period rules only; authentication and ownership are still enforced.
public record ProgramScheduleResponse(
        OffsetDateTime applicationStartAt, OffsetDateTime applicationDeadlineAt,
        OffsetDateTime evaluationStartAt, OffsetDateTime evaluationDeadlineAt,
        OffsetDateTime serverNow, Status periodStatus,
        boolean canApply, boolean canEditApplication, boolean canCancelApplication, boolean canEvaluate
) {
    public static ProgramScheduleResponse from(Program program) {
        return from(program, Instant.now());
    }

    public static ProgramScheduleResponse from(Program program, Instant now) {
        Instant start = ProgramTimes.applicationStart(program);
        Instant end = ProgramTimes.applicationDeadline(program);
        Instant evaluationStart = ProgramTimes.evaluationStart(program);
        Instant evaluationEnd = ProgramTimes.evaluationDeadline(program);
        boolean applicationOpen = ProgramTimes.open(now, start, end);
        boolean published = program.getStatus() != Status.DRAFT && program.getStatus() != Status.INACTIVE;
        Status status = program.getStatus();
        if (published && end != null) {
            if (start != null && now.isBefore(start)) status = Status.SCHEDULED;
            else if (now.isBefore(end)) status = Status.RECRUITING;
            else if (evaluationEnd != null && !now.isBefore(evaluationEnd)) status = Status.INACTIVE;
            else if (evaluationStart != null && now.isBefore(evaluationStart)) status = Status.PENDING_EVALUATION;
            else status = Status.ACTIVE;
        }
        return new ProgramScheduleResponse(ProgramTimes.display(start), ProgramTimes.display(end),
                ProgramTimes.display(evaluationStart), ProgramTimes.display(evaluationEnd),
                ProgramTimes.display(now), status, published && applicationOpen, applicationOpen,
                evaluationStart == null || now.isBefore(evaluationStart),
                ProgramTimes.open(now, evaluationStart, evaluationEnd));
    }
}
