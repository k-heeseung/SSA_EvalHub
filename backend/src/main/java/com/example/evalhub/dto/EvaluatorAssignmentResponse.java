package com.example.evalhub.dto;

import com.example.evalhub.entity.AssignmentStatus;

import java.time.LocalDate;

// 평가자 대시보드에서 배정(프로그램)별 채점 진행 현황을 보여주기 위한 응답이다.
// status 는 팀별 제출 현황으로부터 계산된 집계 상태다.
public record EvaluatorAssignmentResponse(
        Long id,
        Long programId,
        String programTitle,
        LocalDate evaluationStart,
        LocalDate evaluationDeadline,
        AssignmentStatus status,
        int teamCount,
        int submittedCount,
        int draftCount
) {
}
