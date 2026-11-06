package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CriterionMaxScoreIntegrationTests {
    @Autowired ProgramManagementService manager;
    @Autowired EvaluationService evaluator;
    @Autowired ApplicationService applicant;
    @Autowired ProgramRepository programs;
    @Autowired TeamRepository teams;
    @Autowired UserRepository users;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired ApplicationRepository applications;
    @Autowired EvaluationCriterionRepository criteria;
    @Autowired ObjectMapper mapper;
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    Program program;
    Long programId, teamId, evaluatorId, assignmentId;

    @BeforeEach void setup() {
        program = programs.save(new Program(null, "max-score-test", null, ProgramType.MODULE_A,
            LocalDate.now().minusDays(2), LocalDate.now().minusDays(1),
            LocalDate.now().minusDays(1), LocalDate.now().plusDays(2), null));
        programId = program.getId();
        teamId = teams.save(new Team(program,"team",ParticipantType.TEAM,null,"team",null,null)).getId();
        var user = users.save(new User(UUID.randomUUID()+"@example.com","encoded",Role.EVALUATOR));
        evaluatorId = user.getId();
        assignmentId = assignments.save(new EvaluationAssignment(program,user)).getId();
        em.flush();
    }
    CriterionResponse criterion(String max, int order) {
        return manager.createCriterion(programId,new CreateCriterionRequest("item"+order,null,new BigDecimal(max),order));
    }
    SaveEvaluationRequest scores(List<CriterionResponse> cs, String... values) {
        var scores = new ArrayList<EvaluationScoreRequest>();
        for(int i=0;i<values.length;i++) scores.add(new EvaluationScoreRequest(cs.get(i).id(),new BigDecimal(values[i])));
        return new SaveEvaluationRequest(null,scores);
    }
    @Test void variableMaxScoresPersistAndTotalsAreSimpleSums() {
        var cs=List.of(criterion("40",1),criterion("35",2),criterion("25",3));
        assertThat(evaluator.saveDraft(assignmentId,teamId,evaluatorId,scores(cs,"32")).totalScore()).isEqualByComparingTo("32");
        assertThat(evaluator.submit(assignmentId,teamId,evaluatorId,scores(cs,"32","28","20")).totalScore()).isEqualByComparingTo("80");
        em.flush(); em.clear();
        assertThat(manager.findCriteria(programId)).extracting(CriterionResponse::maxScore)
            .containsExactly(new BigDecimal("40.00"),new BigDecimal("35.00"),new BigDecimal("25.00"));
        assertThat(evaluator.getEvaluationResults(programId).get(0).evaluations().get(0).submission().totalScore()).isEqualByComparingTo("80");
        assertThat(evaluator.submit(assignmentId,teamId,evaluatorId,scores(cs,"40","0","25")).totalScore()).isEqualByComparingTo("65");
    }
    @ParameterizedTest @ValueSource(strings={"-1","40.01","1.001"})
    void rejectsInvalidScoresWithoutStartingEvaluation(String value) {
        var c=criterion("40",1);
        assertThatThrownBy(()->evaluator.saveDraft(assignmentId,teamId,evaluatorId,scores(List.of(c),value)))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(program.isEvaluationStarted()).isFalse();
    }
    @Test void incompleteFinalSubmissionIsRejected() {
        var cs=List.of(criterion("40",1),criterion("35",2));
        assertThatThrownBy(()->evaluator.submit(assignmentId,teamId,evaluatorId,scores(cs,"32")))
            .isInstanceOf(ResponseStatusException.class);
    }
    @Test void firstDraftLocksStructureAndMaxButAllowsTextChanges() {
        var c=criterion("40",1);
        evaluator.saveDraft(assignmentId,teamId,evaluatorId,scores(List.of(c),"0"));
        assertThatThrownBy(()->criterion("20",2)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.deleteCriterion(programId,c.id())).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.updateCriterion(programId,c.id(),new UpdateCriterionRequest("item",null,new BigDecimal("50"),1)))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.updateCriterion(programId,c.id(),new UpdateCriterionRequest("item",null,new BigDecimal("40"),2)))
            .isInstanceOf(ResponseStatusException.class);
        manager.updateCriterion(programId,c.id(),new UpdateCriterionRequest("renamed","description",new BigDecimal("40"),1));
        em.flush(); em.clear();
        assertThat(manager.findCriteria(programId)).singleElement().satisfies(saved->{
            assertThat(saved.name()).isEqualTo("renamed"); assertThat(saved.maxScore()).isEqualByComparingTo("40");
        });
    }
    @ParameterizedTest @ValueSource(strings={"0","-1","0.001","1000000"})
    @WithMockUser(roles="MANAGER")
    void apiRejectsInvalidMax(String max) throws Exception {
        mvc.perform(post("/api/programs/{id}/criteria",programId).with(csrf()).contentType("application/json")
            .content("{\"name\":\"invalid\",\"maxScore\":"+max+",\"displayOrder\":1}"))
            .andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(roles="MANAGER")
    void apiAcceptsDecimalsAndRejectsMissingMaxAndLockedChanges() throws Exception {
        mvc.perform(post("/api/programs/{id}/criteria",programId).with(csrf()).contentType("application/json")
            .content("{\"name\":\"decimal\",\"maxScore\":40.25,\"displayOrder\":1}"))
            .andExpect(status().is2xxSuccessful()).andExpect(jsonPath("$.maxScore").value(40.25));
        mvc.perform(post("/api/programs/{id}/criteria",programId).with(csrf()).contentType("application/json")
            .content("{\"name\":\"missing\",\"displayOrder\":2}"))
            .andExpect(status().isBadRequest());
        var c=manager.findCriteria(programId).get(0);
        evaluator.saveDraft(assignmentId,teamId,evaluatorId,scores(List.of(c),"40.25"));
        mvc.perform(delete("/api/programs/{id}/criteria/{cid}",programId,c.id()).with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/programs/{id}/criteria",programId).with(csrf()).contentType("application/json")
            .content("{\"name\":\"locked\",\"maxScore\":20,\"displayOrder\":2}"))
            .andExpect(status().isConflict());
    }
    @Test void noCustomFieldsAllowsApplicationSubmission() {
        program.updateSchedule(java.time.Instant.now().minusSeconds(60),java.time.Instant.now().plusSeconds(3600),
            java.time.Instant.now().plusSeconds(7200),java.time.Instant.now().plusSeconds(10800));
        program.updateParticipantType(ParticipantType.INDIVIDUAL);
        var member=users.save(new User(UUID.randomUUID()+"@example.com","encoded",Role.MEMBER));
        var team=teams.save(new Team(program,"applicant",ParticipantType.INDIVIDUAL,null,"applicant",null,null));
        var application=applications.save(new Application(program,member,team));
        assertThat(manager.replaceFormFields(programId,new ReplaceFormFieldsRequest(List.of()))).isEmpty();
        var request=new SaveApplicationRequest(null,"applicant",member.getEmail(),null,List.of(),List.of());
        assertThat(applicant.submit(application.getId(),member.getId(),request).status()).isEqualTo(ApplicationStatus.SUBMITTED);
    }
}
