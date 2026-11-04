package com.example.evalhub;

import com.example.evalhub.dto.EvaluationScoreRequest;
import com.example.evalhub.dto.EvaluationSubmissionResponse;
import com.example.evalhub.dto.SaveEvaluationRequest;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.EvaluationService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class EvaluationScoreReplacementIntegrationTests {
    @Autowired EvaluationService service;
    @Autowired UserRepository users;
    @Autowired ProgramRepository programs;
    @Autowired TeamRepository teams;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired EvaluationCriterionRepository criteria;
    @Autowired EvaluationSubmissionRepository submissions;
    @Autowired EntityManager entityManager;
    private Long assignmentId;
    private Long teamId;
    private Long evaluatorId;
    private Long firstCriterion;
    private Long secondCriterion;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();
        User manager = users.save(new User("manager-" + suffix + "@example.com", "encoded", Role.MANAGER));
        User evaluator = users.save(new User("evaluator-" + suffix + "@example.com", "encoded", Role.EVALUATOR));
        Program program = programs.save(new Program(manager, "score-replacement", null, ProgramType.MODULE_A,
                LocalDate.now().minusDays(4), LocalDate.now().minusDays(2),
                LocalDate.now().minusDays(1), LocalDate.now().plusDays(2), null));
        Team team = teams.save(new Team(program, "team", ParticipantType.INDIVIDUAL, null, "name", null, null));
        assignmentId = assignments.save(new EvaluationAssignment(program, evaluator)).getId();
        teamId = team.getId();
        evaluatorId = evaluator.getId();
        firstCriterion = criteria.save(new EvaluationCriterion(program, "first", null, BigDecimal.ONE, 1)).getId();
        secondCriterion = criteria.save(new EvaluationCriterion(program, "second", null, BigDecimal.ONE, 2)).getId();
        save(List.of(score(firstCriterion, 8), score(secondCriterion, 7)));
    }

    @Test
    void omittedScoreIsDeletedAndUpdatedTotalSurvivesReload() {
        EvaluationSubmissionResponse saved = save(List.of(score(secondCriterion, 6)));
        assertThat(saved.scores()).hasSize(1);
        assertThat(saved.totalScore()).isEqualByComparingTo("6");
        assertReloaded(saved.id(), List.of(secondCriterion), "6");
    }

    @Test
    void emptyScoresDeleteAllAndLeaveDraftWithZeroTotal() {
        EvaluationSubmissionResponse saved = save(List.of());
        assertThat(saved.scores()).isEmpty();
        assertThat(saved.status()).isEqualTo(SubmissionStatus.DRAFT);
        assertReloaded(saved.id(), List.of(), "0");
    }

    @Test
    void explicitZeroIsKeptAsAScore() {
        EvaluationSubmissionResponse saved = save(List.of(score(firstCriterion, 0)));
        assertReloaded(saved.id(), List.of(firstCriterion), "0");
    }

    @Test
    void incompleteSubmissionIsRejectedBeforeExistingScoresChange() {
        assertThatThrownBy(() -> service.submit(assignmentId, teamId, evaluatorId,
                new SaveEvaluationRequest(null, List.of(score(secondCriterion, 6)))))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        var saved = service.getEvaluationView(assignmentId, teamId, evaluatorId).submission();
        assertThat(saved.scores()).hasSize(2);
        assertThat(saved.totalScore()).isEqualByComparingTo("15");
    }

    @Test
    void clearingAScoreStillPreventsFinalSubmission() {
        save(List.of(score(secondCriterion, 7)));
        assertThatThrownBy(() -> service.submit(assignmentId, teamId, evaluatorId,
                new SaveEvaluationRequest(null, List.of(score(secondCriterion, 7)))))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void allCriteriaIncludingZeroCanBeSubmittedAfterClearingAndRefilling() {
        save(List.of());
        var saved = service.submit(assignmentId, teamId, evaluatorId,
                new SaveEvaluationRequest(null, List.of(score(firstCriterion, 0), score(secondCriterion, 7))));
        assertThat(saved.status()).isEqualTo(SubmissionStatus.SUBMITTED);
        assertReloaded(saved.id(), List.of(firstCriterion, secondCriterion), "7");
    }

    private EvaluationSubmissionResponse save(List<EvaluationScoreRequest> scores) {
        return service.saveDraft(assignmentId, teamId, evaluatorId, new SaveEvaluationRequest(null, scores));
    }

    private EvaluationScoreRequest score(Long criterion, int value) {
        return new EvaluationScoreRequest(criterion, BigDecimal.valueOf(value));
    }

    private void assertReloaded(Long submissionId, List<Long> expectedCriteria, String total) {
        entityManager.flush();
        entityManager.clear();
        var loaded = service.getEvaluationView(assignmentId, teamId, evaluatorId).submission();
        assertThat(loaded.scores()).extracting(item -> item.criterionId()).containsExactlyInAnyOrderElementsOf(expectedCriteria);
        assertThat(loaded.totalScore()).isEqualByComparingTo(total);
        assertThat(submissions.findById(submissionId).orElseThrow().getTotalScore()).isEqualByComparingTo(total);
    }
}
