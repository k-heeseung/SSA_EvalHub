package com.example.evalhub.dto;

import com.example.evalhub.entity.ApplicationStatus;
import com.example.evalhub.entity.ParticipantType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// 지원서 작성/열람 화면에 필요한 데이터를 한 번에 내려준다: 프로그램 정보 + 양식 항목별 답변 + 첨부파일.
public record ApplicationDetailResponse(
        Long applicationId,
        Long programId,
        String programTitle,
        Long applicantId,
        Long teamId,
        String teamName,
        ApplicationStatus status,
        LocalDate applicationDeadline,
        LocalDate evaluationStart,
        LocalDateTime submittedAt,
        LocalDateTime updatedAt,
        boolean attachmentsEnabled,
        Integer maxAttachments,
        ParticipantType participantType,
        ApplicantInfo applicantInfo,
        List<FieldAnswer> fields,
        List<ParticipantAttachmentResponse> attachments,
        ProgramScheduleResponse schedule
) {

    // 양식 항목 정의와 지원자가 입력한 값을 함께 담는다. value는 미작성 시 null.
    public record FieldAnswer(
            Long fieldId,
            String label,
            String fieldType,
            boolean required,
            Integer displayOrder,
            List<String> options,
            String value
    ) {
    }
}
