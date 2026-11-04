package com.example.evalhub.dto;

import java.util.List;

// scores는 현재 입력된 전체 점수 목록이다. 누락된 항목의 기존 점수는 삭제된다.
public record SaveEvaluationRequest(
        String oneLineComment,
        List<EvaluationScoreRequest> scores
) {
}
