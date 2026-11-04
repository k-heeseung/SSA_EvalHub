package com.example.evalhub.util;

import com.example.evalhub.entity.Program;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Objects;

public final class ProgramTimes {
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private ProgramTimes() {}

    public static Instant startOfDay(LocalDate date) {
        return date == null ? null : date.atStartOfDay(ZONE).toInstant();
    }

    public static Instant afterLastDay(LocalDate date) {
        return date == null ? null : startOfDay(date.plusDays(1));
    }

    public static OffsetDateTime display(Instant instant) {
        return instant == null ? null : instant.atZone(ZONE).toOffsetDateTime();
    }

    public static LocalDate startDate(Instant instant) {
        return instant == null ? null : instant.atZone(ZONE).toLocalDate();
    }

    public static LocalDate lastDate(Instant exclusiveEnd) {
        return exclusiveEnd == null ? null : startDate(exclusiveEnd.minusNanos(1));
    }

    // Old clients resend unchanged dates when editing other fields: preserve precise times.
    public static Instant resolve(OffsetDateTime precise, LocalDate date, LocalDate previousDate,
                                  Instant previous, boolean deadline) {
        if (precise != null) return precise.toInstant();
        if (date == null || Objects.equals(date, previousDate)) return previous;
        return deadline ? afterLastDay(date) : startOfDay(date);
    }

    public static Instant applicationStart(Program p) {
        return p.getApplicationStartAt() != null ? p.getApplicationStartAt() : startOfDay(p.getApplicationStart());
    }
    public static Instant applicationDeadline(Program p) {
        return p.getApplicationDeadlineAt() != null ? p.getApplicationDeadlineAt() : afterLastDay(p.getApplicationDeadline());
    }
    public static Instant evaluationStart(Program p) {
        return p.getEvaluationStartAt() != null ? p.getEvaluationStartAt() : startOfDay(p.getEvaluationStart());
    }
    public static Instant evaluationDeadline(Program p) {
        return p.getEvaluationDeadlineAt() != null ? p.getEvaluationDeadlineAt() : afterLastDay(p.getEvaluationDeadline());
    }
    public static boolean open(Instant now, Instant start, Instant deadline) {
        return (start == null || !now.isBefore(start)) && (deadline == null || now.isBefore(deadline));
    }
}
