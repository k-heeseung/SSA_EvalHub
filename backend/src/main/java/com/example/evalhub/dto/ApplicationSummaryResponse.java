package com.example.evalhub.dto;

import com.example.evalhub.entity.Application;
import com.example.evalhub.entity.ApplicationStatus;
import com.example.evalhub.entity.ParticipantType;

import java.time.LocalDate;
import java.time.LocalDateTime;

// 내 지원 현황 목록에 표시할 요약 정보.
// 마감 D-day 표시와 개인/팀 배지를 위해 프로그램의 마감일·참가 유형을 함께 내려준다.
public record ApplicationSummaryResponse(
        Long applicationId,
        Long programId,
        String programTitle,
        Long teamId,
        String teamName,
        ApplicationStatus status,
        ParticipantType participantType,
        LocalDate applicationDeadline,
        LocalDateTime submittedAt,
        LocalDateTime updatedAt,
        ApplicantInfo applicantInfo,
        ProgramScheduleResponse schedule
) {

    public static ApplicationSummaryResponse from(Application application) {
        return new ApplicationSummaryResponse(
                application.getId(),
                application.getProgram().getId(),
                application.getProgram().getTitle(),
                application.getTeam() == null ? null : application.getTeam().getId(),
                application.getTeam() == null ? null : application.getTeam().getName(),
                application.getStatus(),
                application.getProgram().getParticipantType(),
                application.getProgram().getApplicationDeadline(),
                application.getSubmittedAt(),
                application.getUpdatedAt(),
                ApplicantInfo.of(application.getTeam()),
                ProgramScheduleResponse.from(application.getProgram())
        );
    }
}
