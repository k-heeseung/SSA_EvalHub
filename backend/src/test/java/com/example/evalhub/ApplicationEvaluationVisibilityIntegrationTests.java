package com.example.evalhub;

import com.example.evalhub.dto.EvaluationTeamStatusResponse;
import com.example.evalhub.dto.ApplicationDetailResponse;
import com.example.evalhub.dto.ApplicantInfo;
import com.example.evalhub.dto.CreateAssignmentRequest;
import com.example.evalhub.dto.EvaluationScoreRequest;
import com.example.evalhub.dto.SaveApplicationRequest;
import com.example.evalhub.dto.SaveEvaluationRequest;
import com.example.evalhub.dto.StartApplicationRequest;
import com.example.evalhub.entity.Application;
import com.example.evalhub.entity.ApplicationFormField;
import com.example.evalhub.entity.ApplicationStatus;
import com.example.evalhub.entity.EvaluationAssignment;
import com.example.evalhub.entity.EvaluationCriterion;
import com.example.evalhub.entity.ParticipantType;
import com.example.evalhub.entity.ParticipantAttachment;
import com.example.evalhub.entity.Program;
import com.example.evalhub.entity.ProgramType;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.Status;
import com.example.evalhub.entity.Team;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.ApplicationFormFieldRepository;
import com.example.evalhub.repository.ApplicationRepository;
import com.example.evalhub.repository.EvaluationAssignmentRepository;
import com.example.evalhub.repository.EvaluationCriterionRepository;
import com.example.evalhub.repository.ProgramRepository;
import com.example.evalhub.repository.ParticipantAttachmentRepository;
import com.example.evalhub.repository.TeamRepository;
import com.example.evalhub.repository.UserRepository;
import com.example.evalhub.service.ApplicationService;
import com.example.evalhub.service.EvaluationService;
import com.example.evalhub.service.ProgramManagementService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class ApplicationEvaluationVisibilityIntegrationTests {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private EvaluationService evaluationService;

    @Autowired
    private ProgramManagementService programManagementService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private ApplicationFormFieldRepository formFieldRepository;

    @Autowired
    private EvaluationAssignmentRepository assignmentRepository;

    @Autowired
    private EvaluationCriterionRepository criterionRepository;

    @Autowired
    private ParticipantAttachmentRepository attachmentRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void newTeamApplicationDoesNotPrefillNames() {
        User manager = saveUser(Role.MANAGER);
        User member = userRepository.save(new User(
                "named-" + UUID.randomUUID() + "@example.com",
                "encoded-password",
                Role.MEMBER,
                "자동 입력되면 안 되는 이름",
                null
        ));
        Program program = saveProgram(manager);
        program.updateParticipantType(ParticipantType.TEAM);
        program.changeStatus(Status.RECRUITING);

        ApplicationDetailResponse created = applicationService.startApplication(
                program.getId(), member.getId(), new StartApplicationRequest(null));

        assertThat(created.teamName()).isEmpty();
        assertThat(created.applicantInfo().name()).isNull();
        assertThat(created.applicantInfo().email()).isNull();
    }

    @Test
    void failedResubmissionPersistsDraftStatus() {
        User manager = saveUser(Role.MANAGER);
        User member = saveUser(Role.MEMBER);
        Program program = saveProgram(manager);
        Team team = saveTeam(program, "applicant-team");
        Application application = new Application(program, member, team);
        application.submit();
        applicationRepository.save(application);

        ApplicationFormField requiredField = formFieldRepository.save(
                new ApplicationFormField(program, "지원 동기", "TEXT", true, 1, null));
        SaveApplicationRequest request = new SaveApplicationRequest(
                null,
                "지원자",
                null,
                null,
                List.of(),
                List.of(new SaveApplicationRequest.AnswerInput(requiredField.getId(), ""))
        );

        assertThatThrownBy(() -> applicationService.submit(application.getId(), member.getId(), request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));

        entityManager.flush();
        entityManager.clear();
        assertThat(applicationRepository.findById(application.getId()).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.DRAFT);
    }

    @Test
    void evaluatorSeesOnlyEvaluableTeamsAndCountsAllApplicationMembers() {
        User manager = saveUser(Role.MANAGER);
        User draftMember = saveUser(Role.MEMBER);
        User submittedMember = saveUser(Role.MEMBER);
        User evaluator = saveUser(Role.EVALUATOR);
        Program program = saveProgram(manager);
        EvaluationAssignment assignment = assignmentRepository.save(new EvaluationAssignment(program, evaluator));

        var assignmentSummary = evaluationService.getEvaluatorAssignments(evaluator.getId()).getFirst();
        assertThat(assignmentSummary.evaluationStart()).isEqualTo(program.getEvaluationStart());
        assertThat(assignmentSummary.evaluationDeadline()).isEqualTo(program.getEvaluationDeadline());

        Team draftTeam = saveTeam(program, "draft-team");
        applicationRepository.save(new Application(program, draftMember, draftTeam));

        Team submittedTeam = saveTeam(program, "submitted-team");
        submittedTeam.updateParticipantType(ParticipantType.TEAM);
        submittedTeam.applyApplicantInfo("submitted-team", new ApplicantInfo(
                "팀장",
                "leader@example.com",
                "01012345678",
                List.of(
                        new ApplicantInfo.Member("팀원 1", "member1@example.com", "01011112222"),
                        new ApplicantInfo.Member("팀원 2", "member2@example.com", null)
                )
        ).toJson(), "01012345678");
        Application submittedApplication = new Application(program, submittedMember, submittedTeam);
        submittedApplication.submit();
        applicationRepository.save(submittedApplication);

        Team managerCreatedTeam = saveTeam(program, "manager-team");

        EvaluationCriterion criterion1 = criterionRepository.save(new EvaluationCriterion(
                program, "질문 1", null, BigDecimal.ONE, 1));
        EvaluationCriterion criterion2 = criterionRepository.save(new EvaluationCriterion(
                program, "질문 2", null, BigDecimal.ONE, 2));
        var savedEvaluation = evaluationService.saveDraft(
                assignment.getId(),
                submittedTeam.getId(),
                evaluator.getId(),
                new SaveEvaluationRequest(
                        "합계 확인",
                        List.of(
                                new EvaluationScoreRequest(criterion1.getId(), new BigDecimal("7.5")),
                                new EvaluationScoreRequest(criterion2.getId(), new BigDecimal("8.5"))
                        )
                )
        );
        assertThat(savedEvaluation.totalScore()).isEqualByComparingTo("16");

        List<EvaluationTeamStatusResponse> visibleTeams = evaluationService
                .getAssignmentTeams(assignment.getId(), evaluator.getId());

        assertThat(visibleTeams).extracting(EvaluationTeamStatusResponse::name)
                .containsExactly(submittedTeam.getName(), managerCreatedTeam.getName())
                .doesNotContain(draftTeam.getName());
        assertThat(visibleTeams)
                .filteredOn(team -> team.teamId().equals(submittedTeam.getId()))
                .singleElement()
                .extracting(EvaluationTeamStatusResponse::memberCount)
                .isEqualTo(3);
        assertThat(visibleTeams)
                .filteredOn(team -> team.teamId().equals(submittedTeam.getId()))
                .singleElement()
                .extracting(EvaluationTeamStatusResponse::totalScore)
                .isEqualTo(new BigDecimal("16.0"));
        BigDecimal maxTotalScore = visibleTeams.stream()
                .filter(team -> team.teamId().equals(submittedTeam.getId()))
                .findFirst()
                .orElseThrow()
                .maxTotalScore();
        assertThat(maxTotalScore).isEqualByComparingTo("20");
        assertThat(programManagementService.findTeam(program.getId(), submittedTeam.getId()).memberCount())
                .isEqualTo(3);
        assertThat(programManagementService.findTeam(program.getId(), submittedTeam.getId()).attachmentCount())
                .isZero();

        attachmentRepository.save(new ParticipantAttachment(
                managerCreatedTeam,
                "발표자료.pdf",
                "stored.pdf",
                "application/pdf",
                100L,
                "test/stored.pdf"
        ));
        assertThat(programManagementService.findTeam(program.getId(), managerCreatedTeam.getId()).attachmentCount())
                .isEqualTo(1);

        var evaluationView = evaluationService.getEvaluationView(
                assignment.getId(), submittedTeam.getId(), evaluator.getId());
        assertThat(evaluationView.application()).isNotNull();
        assertThat(evaluationView.application().applicantInfo().name()).isEqualTo("팀장");
        assertThat(evaluationView.application().applicantInfo().members()).hasSize(2);

        assertThatThrownBy(() -> evaluationService.getEvaluationView(
                assignment.getId(), draftTeam.getId(), evaluator.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void assigningEvaluatorReopensCompletedProgram() {
        User manager = saveUser(Role.MANAGER);
        User evaluator = saveUser(Role.EVALUATOR);
        Program program = saveProgram(manager);
        program.changeStatus(Status.INACTIVE);
        programRepository.flush();

        programManagementService.createAssignment(
                program.getId(),
                new CreateAssignmentRequest(evaluator.getId())
        );

        entityManager.flush();
        entityManager.clear();

        assertThat(programRepository.findById(program.getId()).orElseThrow().getStatus())
                .isEqualTo(Status.ACTIVE);
    }

    private User saveUser(Role role) {
        return userRepository.save(new User(
                role.name().toLowerCase() + "-" + UUID.randomUUID() + "@example.com",
                "encoded-password",
                role
        ));
    }

    private Program saveProgram(User manager) {
        return programRepository.save(new Program(
                manager,
                "visibility-test-" + UUID.randomUUID(),
                null,
                ProgramType.MODULE_A,
                LocalDate.now(),
                LocalDate.now().plusDays(10),
                LocalDate.now().plusDays(11),
                LocalDate.now().plusDays(20),
                null
        ));
    }

    private Team saveTeam(Program program, String name) {
        return teamRepository.save(new Team(
                program,
                name,
                ParticipantType.INDIVIDUAL,
                null,
                name,
                null,
                null
        ));
    }
}
