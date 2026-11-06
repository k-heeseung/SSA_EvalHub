package com.example.evalhub.dto;
import com.example.evalhub.entity.Team;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
public record BonusScoreResponse(Long itemId, String name, BigDecimal maxScore, BigDecimal score) {
    public static List<BonusScoreResponse> from(Team team) {
        if (!team.getProgram().isBonusEnabled()) return List.of();
        return team.getProgram().getBonusItems().stream().map(item -> new BonusScoreResponse(
                item.getId(), item.getName(), item.getMaxScore(), team.getBonusScores().stream()
                .filter(s -> Objects.equals(s.getBonusItem().getId(), item.getId()))
                .map(s -> s.getScore()).filter(Objects::nonNull).findFirst().orElse(null))).toList();
    }
}
