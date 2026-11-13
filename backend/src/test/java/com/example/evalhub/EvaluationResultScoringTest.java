package com.example.evalhub;
import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.service.EvaluationResultScoring;
import com.example.evalhub.service.EvaluationResultScoring.Method;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
class EvaluationResultScoringTest {
 private TeamEvaluationResult team(String... scores) {
  List<EvaluatorSubmissionSummary> rows=new ArrayList<>();
  for(int i=0;i<scores.length;i++) rows.add(new EvaluatorSubmissionSummary((long)i,"judge","심사",scores[i]==null?null:new EvaluationSubmissionResponse((long)i,SubmissionStatus.SUBMITTED,new BigDecimal(scores[i]),null,null,List.of())));
  return new TeamEvaluationResult(1L,"팀",TeamStatus.PENDING,new BigDecimal("5"),rows,List.of());
 }
 @Test void modesAndThreeReviewers() {
  var t=team("60","80","85","90","100");
  assertThat(EvaluationResultScoring.calculate(t,Method.ALL).total()).isEqualByComparingTo("88.00");
  assertThat(EvaluationResultScoring.calculate(t,Method.TRIMMED).total()).isEqualByComparingTo("90.00");
  assertThat(EvaluationResultScoring.calculate(team("70","80","100"),Method.TRIMMED).average()).isEqualByComparingTo("80.00");
 }
 @Test void tiesExcludeExactlyTwoDistinctEntries() {
  var r=EvaluationResultScoring.calculate(team("90","90","90","90"),Method.TRIMMED);
  assertThat(r.excludedIndices()).containsExactly(0,1);
  assertThat(r.average()).isEqualByComparingTo("90.00");
 }
 @Test void incompleteAndInsufficient() {
  for(var m:Method.values()) assertThat(EvaluationResultScoring.calculate(team("90",null),m).total()).isNull();
  assertThat(EvaluationResultScoring.calculate(team("90","80"),Method.TRIMMED).total()).isNull();
  assertThat(EvaluationResultScoring.calculate(team(),Method.ALL).unavailableReason()).isEqualTo("심사위원 미배정");
 }
 @Test void roundingBeforeBonusAndCompetitionRanks() {
  assertThat(EvaluationResultScoring.calculate(team("1","1.1"),Method.ALL).total()).isEqualByComparingTo("6.1");
  assertThat(EvaluationResultScoring.rank(List.of(team("90"),team("90"),team("80"),team((String)null)),Method.ALL)).extracting(EvaluationResultScoring.Scored::rank).containsExactly(1,1,3,null);
 }
}
