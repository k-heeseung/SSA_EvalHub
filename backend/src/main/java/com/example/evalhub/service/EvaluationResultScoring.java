package com.example.evalhub.service;

import com.example.evalhub.dto.BonusScoreResponse;
import com.example.evalhub.dto.TeamEvaluationResult;
import com.example.evalhub.entity.SubmissionStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class EvaluationResultScoring {
    private EvaluationResultScoring() {}
    public enum Method {
        ALL("전체 평균"), TRIMMED("최고·최저 제외 평균");
        public final String label;
        Method(String label) { this.label = label; }
    }
    public record Scored(TeamEvaluationResult team, BigDecimal average, BigDecimal bonus,
                         BigDecimal total, List<Integer> excludedIndices, String unavailableReason, Integer rank) {}

    public static Scored calculate(TeamEvaluationResult team, Method method) {
        var evaluations = team.evaluations();
        var bonus = team.bonusScore();
        if (team.bonusScores() != null && !team.bonusScores().isEmpty()) {
            bonus = team.bonusScores().stream().map(BonusScoreResponse::score).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        bonus = Objects.requireNonNullElse(bonus, BigDecimal.ZERO).setScale(1, RoundingMode.HALF_UP);
        if (evaluations == null || evaluations.isEmpty()) return unavailable(team, bonus, "심사위원 미배정");
        long submitted = evaluations.stream().filter(e -> e.submission() != null && e.submission().status() == SubmissionStatus.SUBMITTED).count();
        if (submitted != evaluations.size()) return unavailable(team, bonus, "심사 " + (evaluations.size() - submitted) + "명 미제출");
        if (method == Method.TRIMMED && submitted <= 2) return unavailable(team, bonus, "제출 심사위원 2명 이하");
        var scores = evaluations.stream().map(e -> e.submission().totalScore()).toList();
        if (scores.stream().anyMatch(score -> score == null || score.signum() < 0 || score.stripTrailingZeros().scale() > 2)) return unavailable(team, bonus, "심사 점수 확인 필요");
        List<Integer> excluded = new ArrayList<>();
        if (method == Method.TRIMMED) {
            int min = 0;
            for (int i = 1; i < scores.size(); i++) if (scores.get(i).compareTo(scores.get(min)) < 0) min = i;
            excluded.add(min);
            int max = min == 0 ? 1 : 0;
            for (int i = 0; i < scores.size(); i++) if (i != min && scores.get(i).compareTo(scores.get(max)) > 0) max = i;
            excluded.add(max);
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (int i = 0; i < scores.size(); i++) if (!excluded.contains(i)) sum = sum.add(scores.get(i));
        var average = sum.divide(BigDecimal.valueOf(scores.size() - excluded.size()), 1, RoundingMode.HALF_UP);
        return new Scored(team, average, bonus, average.add(bonus).setScale(1, RoundingMode.HALF_UP), List.copyOf(excluded), null, null);
    }
    private static Scored unavailable(TeamEvaluationResult team, BigDecimal bonus, String reason) {
        return new Scored(team, null, bonus, null, List.of(), reason, null);
    }
    public static List<Scored> rank(List<TeamEvaluationResult> teams, Method method) {
        var sorted = teams.stream().map(team -> calculate(team, method))
                .sorted(Comparator.comparing(Scored::total, Comparator.nullsLast(Comparator.reverseOrder()))).toList();
        List<Scored> ranked = new ArrayList<>();
        BigDecimal previous = null;
        int rank = 0;
        for (int i = 0; i < sorted.size(); i++) {
            var row = sorted.get(i);
            if (row.total() != null) {
                if (previous == null || row.total().compareTo(previous) != 0) rank = i + 1;
                previous = row.total();
            }
            ranked.add(new Scored(row.team(), row.average(), row.bonus(), row.total(), row.excludedIndices(), row.unavailableReason(), row.total() == null ? null : rank));
        }
        return ranked;
    }
}
