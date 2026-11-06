package com.example.evalhub.dto;

import com.example.evalhub.entity.SubmissionStatus;

import java.math.BigDecimal;

// 평가자 팀 목록에서 각 팀의 본인 채점 진행 상태를 보여주기 위한 응답이다.
// submissionStatus 가 null 이면 아직 채점을 시작하지 않은 팀이다.
public record EvaluationTeamStatusResponse(
        Long teamId,
        String name,
        String description,
        int memberCount,
        SubmissionStatus submissionStatus,
        BigDecimal totalScore,
        BigDecimal maxTotalScore,
        String oneLineComment,
        java.util.List<BonusScoreResponse> bonusScores
) {
}
