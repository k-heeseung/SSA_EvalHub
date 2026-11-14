package com.example.evalhub;

import com.example.evalhub.entity.*;
import com.example.evalhub.dto.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccountDeletionIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ProgramRepository programs;
    @Autowired TeamRepository teams;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired EvaluationCriterionRepository criteria;
    @Autowired EvaluationSubmissionRepository submissions;
    @Autowired EvaluationService evaluations;
    @Autowired ProgramManagementService management;
    @Autowired PasswordEncoder passwords;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;

    private User account(Role role) {
        return users.saveAndFlush(new User(UUID.randomUUID() + "@example.com", passwords.encode("test-password"), role, "Original Name", "Department"));
    }

    private record Fixture(Program program, Team team, User evaluator, EvaluationAssignment assignment,
                           EvaluationCriterion criterion, EvaluationSubmissionResponse submission) {}

    private Fixture submitted(boolean partial) {
        User evaluator = account(Role.EVALUATOR);
        Program program = new Program(null, "deletion-test", null, ProgramType.MODULE_A, null, null, null, null, null);
        Instant now = Instant.now();
        program.updateSchedule(now.minusSeconds(7200), now.minusSeconds(3600), now.minusSeconds(1800), now.plusSeconds(3600));
        programs.saveAndFlush(program);
        Team team = teams.saveAndFlush(new Team(program, "team", ParticipantType.INDIVIDUAL, null, "Applicant", null, null));
        if (partial) teams.saveAndFlush(new Team(program, "second-team", ParticipantType.INDIVIDUAL, null, "Second", null, null));
        EvaluationCriterion criterion = criteria.saveAndFlush(new EvaluationCriterion(program, "criterion", null, BigDecimal.ONE, 1));
        EvaluationAssignment assignment = assignments.saveAndFlush(new EvaluationAssignment(program, evaluator));
        var submission = evaluations.submit(assignment.getId(), team.getId(), evaluator.getId(),
                new SaveEvaluationRequest("Final evaluation", List.of(new EvaluationScoreRequest(criterion.getId(), new BigDecimal("8")))));
        em.flush();
        return new Fixture(program, team, evaluator, assignment, criterion, submission);
    }

    @ParameterizedTest @EnumSource(value = Role.class, names = {"MANAGER", "SUPER_ADMIN"})
    void managerCannotDeleteManagerOrSuperAdmin(Role role) throws Exception {
        User target = account(role);
        mvc.perform(delete("/api/users/" + target.getId()).with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isForbidden());
        em.clear();
        assertThat(users.findById(target.getId())).isPresent();
        assertThat(users.findById(target.getId()).orElseThrow().isDeleted()).isFalse();
    }

    @Test void managerCanDeleteMember() throws Exception {
        User member = account(Role.MEMBER);
        mvc.perform(delete("/api/users/" + member.getId()).with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        assertThat(users.findById(member.getId())).isEmpty();
    }

    @Test void superAdminCanStillDeleteUnreferencedManager() throws Exception {
        User target = account(Role.MANAGER);
        mvc.perform(delete("/api/users/" + target.getId()).with(user("admin").roles("SUPER_ADMIN")).with(csrf()))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        assertThat(users.findById(target.getId())).isEmpty();
    }

    @ParameterizedTest @EnumSource(value = Role.class, names = {"EVALUATOR", "MEMBER"})
    void otherRolesCannotDeleteAccounts(Role role) throws Exception {
        User target = account(Role.EVALUATOR);
        mvc.perform(delete("/api/users/" + target.getId()).with(user("other").roles(role.name())).with(csrf()))
                .andExpect(status().isForbidden());
        assertThat(target.isDeleted()).isFalse();
    }

    @Test void evaluatorDeletionKeepsScoresResultsAndAssignmentButBlocksLoginAndNewAssignments() throws Exception {
        Fixture f = submitted(false);
        MockCookie token = login(f.evaluator());
        jdbc.update("insert into evaluator_invitations(user_id,recipient_email,status,encrypted_password,expires_at) values (?,?,'PENDING','test-secret',current_timestamp + interval '1 day')",
                f.evaluator().getId(), f.evaluator().getEmail());
        mvc.perform(delete("/api/users/" + f.evaluator().getId()).with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isOk());
        em.flush(); em.clear();

        User deleted = users.findById(f.evaluator().getId()).orElseThrow();
        assertThat(deleted.isDeleted()).isTrue();
        assertThat(assignments.findById(f.assignment().getId())).isPresent();
        var result = evaluations.getEvaluationResults(f.program().getId()).getFirst();
        assertThat(result.evaluations().getFirst().evaluatorName()).isEqualTo("삭제된 심사위원");
        assertThat(result.evaluations().getFirst().evaluatorEmail()).isEmpty();
        assertThat(result.evaluations().getFirst().submission().totalScore()).isEqualByComparingTo("8");
        assertThat(EvaluationResultScoring.calculate(result, EvaluationResultScoring.Method.ALL).total()).isEqualByComparingTo("8");
        assertThat(management.findEvaluators()).extracting(UserResponse::id).doesNotContain(deleted.getId());
        assertThat(management.findEvaluatorsByProgram(f.program().getId()).getFirst().name()).isEqualTo("삭제된 심사위원");
        assertThat(jdbc.queryForObject("select status from evaluator_invitations where user_id=?", String.class, deleted.getId())).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select encrypted_password from evaluator_invitations where user_id=?", String.class, deleted.getId())).isNull();

        mvc.perform(get("/api/auth/me").cookie(token)).andExpect(status().isUnauthorized())
                .andExpect(header().stringValues(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("EVALHUB_ACCESS_TOKEN=;"))));
        mvc.perform(post("/api/auth/login").contentType("application/json").content(loginBody(deleted)))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/evaluators/" + deleted.getId() + "/status").with(user("manager").roles("MANAGER")).with(csrf())
                        .contentType("application/json").content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/programs/" + f.program().getId() + "/assignments").with(user("manager").roles("MANAGER")).with(csrf())
                        .contentType("application/json").content("{\"evaluatorId\":" + deleted.getId() + "}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/evaluators/" + deleted.getId() + "/invitation/retry").with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void cancellingSubmittedOrPartiallySubmittedAssignmentDeletesOnlyItsEvaluations(boolean partial) throws Exception {
        Fixture f = submitted(partial);
        User other = account(Role.EVALUATOR);
        EvaluationAssignment otherAssignment = assignments.saveAndFlush(new EvaluationAssignment(f.program(), other));
        var otherSubmission = evaluations.submit(otherAssignment.getId(), f.team().getId(), other.getId(),
                new SaveEvaluationRequest("Other", List.of(new EvaluationScoreRequest(f.criterion().getId(), BigDecimal.TEN))));
        em.flush();
        // Match separate HTTP requests: old submissions must not remain managed across deletion.
        em.clear();
        mvc.perform(delete("/api/assignments/" + f.assignment().getId()).with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        assertThat(assignments.findById(f.assignment().getId())).isEmpty();
        assertThat(submissions.findById(f.submission().id())).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from evaluation_scores where submission_id=?", Long.class, f.submission().id())).isZero();
        assertThat(submissions.findById(otherSubmission.id())).isPresent();
        var result = evaluations.getEvaluationResults(f.program().getId()).getFirst();
        assertThat(result.evaluations()).hasSize(1);
        assertThat(EvaluationResultScoring.calculate(result, EvaluationResultScoring.Method.ALL).total()).isEqualByComparingTo("10");
        assertThat(users.findById(f.evaluator().getId()).orElseThrow().isDeleted()).isFalse();
        mvc.perform(get("/api/evaluation-assignments/" + f.assignment().getId() + "/teams").cookie(login(f.evaluator())))
                .andExpect(status().isNotFound());
        var replacement = management.createAssignment(f.program().getId(), new CreateAssignmentRequest(f.evaluator().getId()));
        assertThat(replacement.id()).isNotEqualTo(f.assignment().getId());
    }

    @Test void physicallyDeletedMemberCookieReturns401InsteadOfServerError() throws Exception {
        User member = account(Role.MEMBER);
        MockCookie token = login(member);
        mvc.perform(delete("/api/users/" + member.getId()).with(user("manager").roles("MANAGER")).with(csrf()))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        mvc.perform(get("/api/auth/me").cookie(token)).andExpect(status().isUnauthorized());
    }

    private String loginBody(User target) {
        return "{\"email\":\"" + target.getEmail() + "\",\"password\":\"test-password\",\"role\":\"" + target.getRole() + "\"}";
    }

    private MockCookie login(User target) throws Exception {
        var response = mvc.perform(post("/api/auth/login").contentType("application/json").content(loginBody(target)))
                .andExpect(status().isOk()).andReturn().getResponse();
        return MockCookie.parse(response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(value -> value.startsWith("EVALHUB_ACCESS_TOKEN=")).findFirst().orElseThrow());
    }
}
