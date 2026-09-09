package com.example.evalhub.dto;

import java.math.BigDecimal;

// 매니저가 팀별 가산점과 사유(선택)를 입력할 때 사용한다.
public record UpdateTeamBonusRequest(
        BigDecimal bonusScore,
        String bonusReason
) {
}
