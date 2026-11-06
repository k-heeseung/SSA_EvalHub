package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class EvaluationScoreReplacementTest {
    private EvaluationService service;
    private EvaluationScoreRepository scores;
    private EvaluationSubmission submission;
    private EvaluationScore first;
    private EvaluationScore second;

    @BeforeEach
    void setUp() {
        var assignments = mock(EvaluationAssignmentRepository.class);
        var criteria = mock(EvaluationCriterionRepository.class);
        var submissions = mock(EvaluationSubmissionRepository.class);
        scores = mock(EvaluationScoreRepository.class);
        var teams = mock(TeamRepository.class);
        service = new EvaluationService(assignments, criteria, submissions, scores,
                mock(ParticipantAttachmentRepository.class), teams, mock(TeamMemberRepository.class),
                mock(ApplicationRepository.class), mock(ApplicationService.class));
        ReflectionTestUtils.setField(service, "entityManager", mock(jakarta.persistence.EntityManager.class));
        var program = mock(Program.class);
        when(program.getId()).thenReturn(1L);
        var evaluator = mock(User.class);
        when(evaluator.getId()).thenReturn(2L);
        var assignment = mock(EvaluationAssignment.class);
        when(assignment.getProgram()).thenReturn(program);
        when(assignment.getEvaluator()).thenReturn(evaluator);
        when(assignments.findById(3L)).thenReturn(Optional.of(assignment));
        var team = mock(Team.class);
        when(team.getId()).thenReturn(4L);
        when(team.getProgram()).thenReturn(program);
        when(teams.findById(4L)).thenReturn(Optional.of(team));
        var c1 = new EvaluationCriterion(program, "first", null, BigDecimal.ONE, 1);
        var c2 = new EvaluationCriterion(program, "second", null, BigDecimal.ONE, 2);
        ReflectionTestUtils.setField(c1, "id", 5L);
        ReflectionTestUtils.setField(c2, "id", 6L);
        when(criteria.findByProgramIdOrderByDisplayOrderAsc(1L)).thenReturn(List.of(c1, c2));
        submission = new EvaluationSubmission(assignment, team);
        ReflectionTestUtils.setField(submission, "id", 7L);
        when(submissions.findByAssignmentIdAndTeamId(3L, 4L)).thenReturn(Optional.of(submission));
        first = new EvaluationScore(submission, c1, BigDecimal.valueOf(8));
        second = new EvaluationScore(submission, c2, BigDecimal.valueOf(7));
        when(scores.findBySubmissionIdAndCriterionId(7L, 6L)).thenReturn(Optional.of(second));
    }

    @Test
    void omittedScoreIsDeletedWhileRemainingScoreIsUpdated() {
        when(scores.findBySubmissionId(7L)).thenReturn(List.of(first, second), List.of(second));
        var result = save(List.of(new EvaluationScoreRequest(6L, BigDecimal.valueOf(6))));
        verify(scores).deleteAll(List.of(first));
        assertThat(result.scores()).containsExactly(new EvaluationScoreResponse(6L, BigDecimal.valueOf(6)));
        assertThat(result.totalScore()).isEqualByComparingTo("6");
        assertThat(submission.getTotalScore()).isEqualByComparingTo("6");
    }

    @Test
    void clearingAllScoresLeavesAnEmptyDraftWithZeroTotal() {
        when(scores.findBySubmissionId(7L)).thenReturn(List.of(first, second), List.of());
        var result = save(List.of());
        verify(scores).deleteAll(List.of(first, second));
        assertThat(result.scores()).isEmpty();
        assertThat(result.totalScore()).isEqualByComparingTo("0");
        assertThat(submission.getTotalScore()).isEqualByComparingTo("0");
        assertThat(result.status()).isEqualTo(SubmissionStatus.DRAFT);
    }

    @Test
    void zeroIsKeptInsteadOfDeleted() {
        when(scores.findBySubmissionId(7L)).thenReturn(List.of(first, second), List.of(second));
        var result = save(List.of(new EvaluationScoreRequest(6L, BigDecimal.ZERO)));
        verify(scores).deleteAll(List.of(first));
        assertThat(result.scores()).containsExactly(new EvaluationScoreResponse(6L, BigDecimal.ZERO));
    }

    @Test
    void incompleteFinalSubmissionDoesNotModifyStoredScores() {
        assertThatThrownBy(() -> service.submit(3L, 4L, 2L,
                new SaveEvaluationRequest(null, List.of(new EvaluationScoreRequest(6L, BigDecimal.ZERO)))))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(scores);
    }

    private EvaluationSubmissionResponse save(List<EvaluationScoreRequest> requested) {
        return service.saveDraft(3L, 4L, 2L, new SaveEvaluationRequest(null, requested));
    }
}
