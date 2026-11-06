package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import com.example.evalhub.util.RequestTimes;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class ProgramScheduleBoundaryIntegrationTests {
    private static final Instant START = Instant.parse("2030-11-20T09:00:00Z");
    private static final Instant END = START.plusSeconds(60);
    @Autowired ProgramRepository programs;
    @Autowired UserRepository users;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired ApplicationRepository applicationRepository;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired EvaluationCriterionRepository criteria;
    @Autowired ParticipantAttachmentRepository files;
    @Autowired ApplicationService applications;
    @Autowired EvaluationService evaluations;
    @Autowired javax.sql.DataSource dataSource;
    @TempDir Path storage;
    private Program program;
    private User member;
    private User evaluator;
    private Team team;
    private Application application;
    private EvaluationAssignment assignment;
    private EvaluationCriterion criterion;
    private ParticipantAttachmentService attachments;

    @BeforeEach
    void setUp() {
        member = user(Role.MEMBER);
        evaluator = user(Role.EVALUATOR);
        program = new Program(null, "boundary", null, ProgramType.MODULE_A, null, null, null, null, null);
        program.changeStatus(Status.RECRUITING);
        program.updateParticipantType(ParticipantType.INDIVIDUAL);
        program.updateAttachmentSettings(true, 2);
        program.updateSchedule(START, END, END.plusSeconds(60), END.plusSeconds(120));
        programs.save(program);
        team = teams.save(new Team(program, "boundary-team", ParticipantType.INDIVIDUAL, null, "name", null, null));
        members.save(new TeamMember(team, member));
        application = new Application(program, member, team);
        application.submit();
        applicationRepository.save(application);
        assignment = assignments.save(new EvaluationAssignment(program, evaluator));
        criterion = criteria.save(new EvaluationCriterion(program, "criterion", null, BigDecimal.ONE, 0));
        attachments = new ParticipantAttachmentService(storage.toString(), files, teams, members, assignments, applicationRepository);
    }

    static Stream<Arguments> boundaries() {
        return Stream.of(Arguments.of("before-start", START.minusNanos(1), false),
                Arguments.of("at-start", START, true), Arguments.of("before-deadline", END.minusNanos(1), true),
                Arguments.of("at-deadline", END, false), Arguments.of("after-deadline", END.plusNanos(1), false));
    }

    private User user(Role role) {
        return users.save(new User(UUID.randomUUID() + "@example.com", "encoded", role));
    }

    private void at(Instant instant, Runnable action) {
        try (var clock = mockStatic(Instant.class, CALLS_REAL_METHODS)) {
            clock.when(Instant::now).thenReturn(instant);
            action.run();
        }
    }

    private void check(boolean allowed, Runnable action) {
        if (allowed) assertThatCode(action::run).doesNotThrowAnyException();
        else assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @ParameterizedTest(name = "application writes: {0}")
    @MethodSource("boundaries")
    void applicationSaveSubmitAndTeamEdit(String label, Instant instant, boolean allowed) {
        var request = new SaveApplicationRequest(null, "name", null, null, List.of(), List.of());
        var edit = new UpdateTeamInfoRequest(null, "edited", null, null, List.of());
        at(instant, () -> {
            check(allowed, () -> applications.saveDraft(application.getId(), member.getId(), request));
            check(allowed, () -> applications.updateTeamInfo(application.getId(), member.getId(), edit));
            check(allowed, () -> applications.submit(application.getId(), member.getId(), request));
            assertThat(applications.getApplication(application.getId(), member.getId())).isNotNull();
        });
    }

    @ParameterizedTest(name = "start application: {0}")
    @MethodSource("boundaries")
    void newApplicationsUseExactBoundaries(String label, Instant instant, boolean allowed) {
        var newcomer = user(Role.MEMBER);
        at(instant, () -> check(allowed, () -> applications.startApplication(program.getId(), newcomer.getId(), new StartApplicationRequest(null))));
    }

    @ParameterizedTest(name = "attachment upload/delete: {0}")
    @MethodSource("boundaries")
    void attachmentUploadAndDelete(String label, Instant instant, boolean allowed) throws Exception {
        var stored = storage.resolve("old.pdf");
        java.nio.file.Files.writeString(stored, "%PDF");
        var existing = files.save(new ParticipantAttachment(team, "old.pdf", "old.pdf", "application/pdf", 4L, "old.pdf"));
        var pdf = new MockMultipartFile("file", "new.pdf", "application/pdf", "%PDF".getBytes());
        at(instant, () -> {
            check(allowed, () -> attachments.upload(team.getId(), pdf, AuthenticatedUser.from(member)));
            check(allowed, () -> attachments.deleteAttachment(existing.getId(), AuthenticatedUser.from(member)));
            // Physical deletion now waits for the enclosing transaction to commit.
            assertThat(stored).exists();
            assertThat(files.findById(existing.getId()).isPresent()).isEqualTo(!allowed);
            assertThat(files.countByTeamId(team.getId())).isEqualTo(1);
        });
    }

    @ParameterizedTest(name = "evaluation save/submit/edit: {0}")
    @MethodSource("boundaries")
    void evaluationDraftSubmitAndSubmittedEdit(String label, Instant instant, boolean allowed) {
        program.updateSchedule(START.minusSeconds(120), START.minusSeconds(60), START, END);
        var request = new SaveEvaluationRequest("comment", List.of(new EvaluationScoreRequest(criterion.getId(), BigDecimal.ONE)));
        at(instant, () -> {
            check(allowed, () -> evaluations.saveDraft(assignment.getId(), team.getId(), evaluator.getId(), request));
            check(allowed, () -> evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(), request));
            if (allowed) check(true, () -> evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(), request));
        });
    }

    @ParameterizedTest(name = "cancellation: {0}")
    @MethodSource("boundaries")
    void cancellationStopsAtEvaluationStart(String label, Instant instant, boolean ignored) {
        program.updateSchedule(START.minusSeconds(120), START.minusSeconds(60), END, END.plusSeconds(60));
        at(instant, () -> check(instant.isBefore(END), () -> applications.cancelApplication(application.getId(), member.getId())));
    }

    @Test
    void managerCanEditApplicationAfterApplicationAndEvaluationDeadlines() {
        at(END.plusSeconds(3600), () -> {
            var result = applications.updateApplicationByTeam(team.getId(),
                    new SaveApplicationRequest(null, "manager edit", null, null, List.of(), List.of()));
            assertThat(result).isNotNull();
            assertThat(application.isSubmitted()).isTrue();
            assertThat(ApplicantInfo.of(team).name()).isEqualTo("manager edit");
        });
    }

    @ParameterizedTest(name = "existing submitted evaluation edit: {0}")
    @MethodSource("boundaries")
    void existingSubmittedEvaluationStillChecksPeriod(String label, Instant instant, boolean allowed) {
        program.updateSchedule(START.minusSeconds(120), START.minusSeconds(60), START, END);
        var original = new SaveEvaluationRequest("original", List.of(new EvaluationScoreRequest(criterion.getId(), BigDecimal.ONE)));
        at(START, () -> evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(), original));
        var edit = new SaveEvaluationRequest("edited", List.of(new EvaluationScoreRequest(criterion.getId(), BigDecimal.TEN)));
        at(instant, () -> {
            check(allowed, () -> evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(), edit));
            var saved = evaluations.getEvaluationView(assignment.getId(), team.getId(), evaluator.getId()).submission();
            assertThat(saved.oneLineComment()).isEqualTo(allowed ? "edited" : "original");
        });
    }

    @Test
    void verificationUsesRequestedServerAndDatabaseTimezones() throws Exception {
        var expected = System.getProperty("verification.timezone");
        if (expected == null) return;
        assertThat(java.util.TimeZone.getDefault().getID()).isEqualTo(expected);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement();
             var result = statement.executeQuery("SHOW TIME ZONE")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString(1)).isEqualTo(expected);
        }
    }

    @ParameterizedTest(name = "request receipt controls late processing: {0}")
    @MethodSource("boundaries")
    void requestReceiptControlsWritesEvenWhenProcessingCrossesDeadline(String label, Instant receipt, boolean allowed) {
        var request = new MockHttpServletRequest();
        request.setAttribute(RequestTimes.RECEIVED_AT, receipt);
        var previous = RequestContextHolder.getRequestAttributes();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        var content = new SaveApplicationRequest(null, "name", null, null, List.of(), List.of());
        var edit = new UpdateTeamInfoRequest(null, "edited", null, null, List.of());
        try {
            at(END.plusSeconds(3600), () -> {
                check(allowed, () -> applications.saveDraft(application.getId(), member.getId(), content));
                check(allowed, () -> applications.updateTeamInfo(application.getId(), member.getId(), edit));
                check(allowed, () -> applications.submit(application.getId(), member.getId(), content));
                check(allowed, () -> attachments.uploadBatch(team.getId(), List.of(
                        new MockMultipartFile("files", "a.pdf", "application/pdf", "%PDF".getBytes()),
                        new MockMultipartFile("files", "b.pdf", "application/pdf", "%PDF".getBytes())), AuthenticatedUser.from(member)));
                assertThat(files.countByTeamId(team.getId())).isEqualTo(allowed ? 2 : 0);
            });
        } finally { RequestContextHolder.setRequestAttributes(previous); }
    }
}
