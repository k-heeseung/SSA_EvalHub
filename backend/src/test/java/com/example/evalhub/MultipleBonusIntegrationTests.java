package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MultipleBonusIntegrationTests {
    @Autowired ProgramManagementService manager;
    @Autowired EvaluationService evaluator;
    @Autowired ProgramRepository programs;
    @Autowired TeamRepository teams;
    @Autowired UserRepository users;
    @Autowired EvaluationAssignmentRepository assignments;
    @Autowired EvaluationCriterionRepository criteria;
    @Autowired ObjectMapper mapper;
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    Long programId, teamId, evaluatorId, assignmentId, criterionId, first, second;

    @BeforeEach void setup() throws Exception {
        var response = manager.createProgram(mapper.readValue("""
            {"title":"bonus-test","type":"MODULE_A","status":"DRAFT","bonusEnabled":true,
             "bonusItems":[{"name":"지역 기업","maxScore":3},{"name":"교육 수료","maxScore":2}]}
            """, CreateProgramRequest.class));
        programId = response.id(); first = response.bonusItems().get(0).id(); second = response.bonusItems().get(1).id();
        var p = programs.findById(programId).orElseThrow();
        teamId = teams.save(new Team(p, "team", ParticipantType.TEAM, null, "team", null, null)).getId();
        var user = users.save(new User(UUID.randomUUID()+"@example.com", "encoded", Role.EVALUATOR));
        evaluatorId = user.getId();
        assignmentId = assignments.save(new EvaluationAssignment(p,user)).getId();
        criterionId = criteria.save(new EvaluationCriterion(p,"criterion",null,BigDecimal.ONE,1)).getId();
        em.flush();
    }
    UpdateTeamBonusRequest scores(BigDecimal a, BigDecimal b) {
        return new UpdateTeamBonusRequest(List.of(new UpdateTeamBonusRequest.Item(first,a), new UpdateTeamBonusRequest.Item(second,b)));
    }
    UpdateProgramRequest update(List<BonusItemRequest> items, boolean enabled) throws Exception {
        var node = mapper.createObjectNode().put("bonusEnabled",enabled);
        node.set("bonusItems",mapper.valueToTree(items));
        return mapper.treeToValue(node,UpdateProgramRequest.class);
    }
    List<BonusItemRequest> items(BigDecimal max) {
        return List.of(new BonusItemRequest(first,"지역 기업",max),new BonusItemRequest(second,"교육 수료",new BigDecimal("2")));
    }
    void start(boolean submit) {
        var request = new SaveEvaluationRequest(null,List.of(new EvaluationScoreRequest(criterionId,new BigDecimal("8"))));
        if(submit) evaluator.submit(assignmentId,teamId,evaluatorId,request);
        else evaluator.saveDraft(assignmentId,teamId,evaluatorId,request);
    }
    @Test void reorderingAndAddingItemPreserveSavedIdsScoresAndLimits() throws Exception {
        manager.updateTeamBonus(programId,teamId,scores(new BigDecimal("3"),BigDecimal.ZERO));
        var response = manager.updateProgram(programId,update(List.of(
            new BonusItemRequest(second,"교육 수료",new BigDecimal("2")),
            new BonusItemRequest(null,"신규 항목",new BigDecimal("30")),
            new BonusItemRequest(first,"지역 기업",new BigDecimal("3"))),true));
        Long added = response.bonusItems().get(1).id();
        assertThat(added).isNotNull();
        manager.updateTeamBonus(programId,teamId,new UpdateTeamBonusRequest(List.of(
            new UpdateTeamBonusRequest.Item(second,BigDecimal.ZERO),
            new UpdateTeamBonusRequest.Item(added,new BigDecimal("25")),
            new UpdateTeamBonusRequest.Item(first,new BigDecimal("3")))));
        em.flush(); em.clear();
        var view = evaluator.getEvaluationView(assignmentId,teamId,evaluatorId);
        assertThat(view.team().bonusScores()).extracting(BonusScoreResponse::itemId).containsExactly(second,added,first);
        assertThat(view.team().bonusScores().get(1).maxScore()).isEqualByComparingTo("30");
        assertThat(view.team().bonusScores().get(2).maxScore()).isEqualByComparingTo("3");
        assertThat(view.team().bonusScore()).isEqualByComparingTo("28");
    }
    @Test void zeroAndMissingScoresSurviveReloadAndAppearInBothEvaluatorViews() {
        manager.updateTeamBonus(programId,teamId,scores(BigDecimal.ZERO,null));
        em.flush(); em.clear();
        var view = evaluator.getEvaluationView(assignmentId,teamId,evaluatorId);
        assertThat(view.team().bonusScore()).isEqualByComparingTo("0");
        assertThat(view.team().bonusScores()).extracting(BonusScoreResponse::score).containsExactly(BigDecimal.ZERO.setScale(2),null);
        assertThat(evaluator.getAssignmentTeams(assignmentId,evaluatorId).get(0).bonusScores()).isEqualTo(view.team().bonusScores());
        assertThat(programs.findById(programId).orElseThrow().isEvaluationStarted()).isFalse();
    }
    @Test void allItemsContributeOnceToAggregateAndCanBeCleared() {
        manager.updateTeamBonus(programId,teamId,scores(new BigDecimal("3"),new BigDecimal("2")));
        start(true); em.flush(); em.clear();
        var result=evaluator.getEvaluationResults(programId).get(0);
        assertThat(result.bonusScore()).isEqualByComparingTo("5");
        assertThat(result.evaluations().get(0).submission().totalScore()).isEqualByComparingTo("8");
        manager.updateTeamBonus(programId,teamId,scores(null,null));
        assertThat(evaluator.getEvaluationResults(programId).get(0).bonusScore()).isNull();
    }
    @Test void outOfRangeRequestDoesNotChangeAnyScore() {
        manager.updateTeamBonus(programId,teamId,scores(BigDecimal.ONE,BigDecimal.ONE));
        assertThatThrownBy(()->manager.updateTeamBonus(programId,teamId,scores(BigDecimal.ZERO,new BigDecimal("3"))))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(teams.findById(teamId).orElseThrow().getBonusScore()).isEqualByComparingTo("2");
    }
    @Test void duplicateMissingForeignAndOverprecisionScoresAreRejected() {
        assertThatThrownBy(()->manager.updateTeamBonus(programId,teamId,new UpdateTeamBonusRequest(List.of(
            new UpdateTeamBonusRequest.Item(first,BigDecimal.ONE),new UpdateTeamBonusRequest.Item(first,BigDecimal.ONE)))))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.updateTeamBonus(programId,teamId,new UpdateTeamBonusRequest(List.of())))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.updateTeamBonus(programId,teamId,new UpdateTeamBonusRequest(List.of(new UpdateTeamBonusRequest.Item(-1L,BigDecimal.ONE)))))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->manager.updateTeamBonus(programId,teamId,scores(new BigDecimal("0.001"),null)))
            .isInstanceOf(ResponseStatusException.class);
    }
    @Test void maximumCanBeReducedBeforeStartButNotBelowAnExistingScore() throws Exception {
        manager.updateProgram(programId,update(items(new BigDecimal("2")),true));
        manager.updateTeamBonus(programId,teamId,scores(new BigDecimal("2"),null));
        var request=update(items(BigDecimal.ONE),true);
        assertThatThrownBy(()->manager.updateProgram(programId,request)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void viewingAloneDoesNotLockDeletionAndItemIdsArePreserved() throws Exception {
        evaluator.getEvaluationView(assignmentId,teamId,evaluatorId);
        var response=manager.updateProgram(programId,update(List.of(new BonusItemRequest(first,"변경",new BigDecimal("3"))),true));
        assertThat(response.bonusItems()).hasSize(1);
        assertThat(response.bonusItems().get(0).id()).isEqualTo(first);
        assertThat(response.evaluationStarted()).isFalse();
    }
    @Test void scoredItemCanBeDeletedBeforeEvaluatorStartsAndItsScoreIsRemoved() throws Exception {
        manager.updateTeamBonus(programId,teamId,scores(new BigDecimal("3"),new BigDecimal("2")));
        manager.updateProgram(programId,update(List.of(new BonusItemRequest(second,"교육 수료",new BigDecimal("2"))),true));
        em.flush(); em.clear();
        var view = evaluator.getEvaluationView(assignmentId,teamId,evaluatorId);
        assertThat(view.team().bonusScores()).hasSize(1);
        assertThat(view.team().bonusScores().get(0).itemId()).isEqualTo(second);
        assertThat(view.team().bonusScore()).isEqualByComparingTo("2");
    }
    @Test void draftOnAnotherTeamLocksDeletionProgramWide() throws Exception {
        var p = programs.findById(programId).orElseThrow();
        var otherTeam = teams.save(new Team(p,"other",ParticipantType.TEAM,null,"other",null,null));
        var otherUser = users.save(new User(UUID.randomUUID()+"@example.com","encoded",Role.EVALUATOR));
        var otherAssignment = assignments.save(new EvaluationAssignment(p,otherUser));
        evaluator.saveDraft(otherAssignment.getId(),otherTeam.getId(),otherUser.getId(),new SaveEvaluationRequest(null,List.of()));
        var request=update(List.of(new BonusItemRequest(first,"지역 기업",new BigDecimal("3"))),true);
        assertThatThrownBy(()->manager.updateProgram(programId,request)).isInstanceOfSatisfying(ResponseStatusException.class,
            ex->assertThat(ex.getStatusCode().value()).isEqualTo(409));
    }
    @Test void directSubmissionLocksMaximumReduction() throws Exception {
        start(true);
        var request=update(items(new BigDecimal("2")),true);
        assertThatThrownBy(()->manager.updateProgram(programId,request)).isInstanceOfSatisfying(ResponseStatusException.class,
            ex->assertThat(ex.getStatusCode().value()).isEqualTo(409));
    }
    @Test void disablingCannotBypassStartedLock() throws Exception {
        start(false); var request=update(items(new BigDecimal("3")),false);
        assertThatThrownBy(()->manager.updateProgram(programId,request)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void increasingMaximumAndAddingItemRemainAllowedAfterStart() throws Exception {
        start(false); var list=new ArrayList<>(items(new BigDecimal("4")));
        list.add(new BonusItemRequest(null,"특허",new BigDecimal("5")));
        var response=manager.updateProgram(programId,update(list,true));
        assertThat(response.bonusItems()).hasSize(3);
        assertThat(response.bonusItems().get(2).id()).isNotNull();
        assertThat(response.evaluationStarted()).isTrue();
    }
    @Test @WithMockUser(roles="EVALUATOR") void evaluatorCannotWriteBonus() throws Exception {
        mvc.perform(patch("/api/programs/"+programId+"/teams/"+teamId+"/bonus").with(csrf())
            .contentType("application/json").content(mapper.writeValueAsString(scores(BigDecimal.ONE,null))))
            .andExpect(status().isForbidden());
    }
    @Test @WithMockUser(roles="MANAGER") void managerApiAcceptsOnlyScoresAndReturnsAllItems() throws Exception {
        mvc.perform(patch("/api/programs/"+programId+"/teams/"+teamId+"/bonus").with(csrf())
            .contentType("application/json").content(mapper.writeValueAsString(scores(BigDecimal.ONE,null))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bonusScores.length()").value(2))
            .andExpect(jsonPath("$.bonusScore").value(1)).andExpect(jsonPath("$.bonusReason").doesNotExist());
    }
}
