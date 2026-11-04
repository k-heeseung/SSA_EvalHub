package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class ProgramInstantEnforcementTests {
    @Autowired ProgramRepository programs;
    @Autowired UserRepository users;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired ApplicationRepository applicationRepository;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired ApplicationService applications;
    @Autowired EvaluationService evaluations;
    @Autowired ParticipantAttachmentService attachments;
    private Program program;
    private User member;
    private Team team;
    private Application application;
    private EvaluationAssignment assignment;
    private User evaluator;
    private final Instant now = Instant.now();

    @BeforeEach
    void setUp() {
        member = users.save(new User(UUID.randomUUID() + "@example.com", "encoded", Role.MEMBER));
        evaluator = users.save(new User(UUID.randomUUID() + "@example.com", "encoded", Role.EVALUATOR));
        program = new Program(null, "instant", null, ProgramType.MODULE_A, null, null, null, null, null);
        program.updateSchedule(now.minusSeconds(7200), now.minusSeconds(3600), now.plusSeconds(3600), now.plusSeconds(7200));
        programs.save(program);
        team = teams.save(new Team(program, "team", ParticipantType.INDIVIDUAL, null, "name", null, null));
        members.save(new TeamMember(team, member));
        application = new Application(program, member, team);
        application.submit();
        applicationRepository.save(application);
        assignment = assignments.save(new EvaluationAssignment(program, evaluator));
    }

    @Test
    void applicationWritesAreBlockedAtPassedInstantWhileReadsRemainAvailable() {
        var request = new SaveApplicationRequest(null, "name", null, null, List.of(), List.of());
        rejected(() -> applications.saveDraft(application.getId(), member.getId(), request), "지원 마감");
        rejected(() -> applications.submit(application.getId(), member.getId(), request), "지원 마감");
        assertThat(applications.getApplication(application.getId(), member.getId()).schedule().canEditApplication()).isFalse();
    }

    @Test
    void attachmentsCannotChangeAfterDeadlineOrBeforeStart() {
        MockMultipartFile file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF".getBytes());
        rejected(() -> attachments.upload(team.getId(), file, AuthenticatedUser.from(member)), "지원 마감");
        program.updateSchedule(now.plusSeconds(3600), now.plusSeconds(7200), now.plusSeconds(7200), now.plusSeconds(10800));
        rejected(() -> attachments.upload(team.getId(), file, AuthenticatedUser.from(member)), "지원 시작");
    }

    @Test
    void evaluationDraftIsBlockedBeforeStartAndAfterDeadline() {
        var request = new SaveEvaluationRequest(null, List.of());
        rejected(() -> evaluations.saveDraft(assignment.getId(), team.getId(), evaluator.getId(), request), "평가 시작");
        program.updateSchedule(now.minusSeconds(7200), now.minusSeconds(3600), now.minusSeconds(1800), now.minusSeconds(1));
        rejected(() -> evaluations.saveDraft(assignment.getId(), team.getId(), evaluator.getId(), request), "평가 마감");
        rejected(() -> evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(), request), "평가 마감");
    }

    @Test
    void cancellationStopsAtEvaluationStartInstant() {
        program.updateSchedule(now.minusSeconds(7200), now.minusSeconds(3600), now.minusSeconds(1), now.plusSeconds(3600));
        rejected(() -> applications.cancelApplication(application.getId(), member.getId()), "평가 시작");
    }

    private void rejected(Runnable action, String reason) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class, error -> {
            assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(error.getReason()).contains(reason);
        });
    }
}
