package com.example.evalhub.controller;

import com.example.evalhub.dto.EvaluationSubmissionResponse;
import com.example.evalhub.dto.EvaluationTeamStatusResponse;
import com.example.evalhub.dto.EvaluationViewResponse;
import com.example.evalhub.dto.EvaluatorAssignmentResponse;
import com.example.evalhub.dto.SaveEvaluationRequest;
import com.example.evalhub.service.EvaluationService;
import com.example.evalhub.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/evaluation-assignments")
@Tag(name = "Evaluation", description = "평가 화면 조회, 임시저장, 최종 제출 API")
@PreAuthorize("hasRole('EVALUATOR')")
public class EvaluationController {

    private final EvaluationService evaluationService;

    public EvaluationController(EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @Operation(summary = "평가자 배정 현황 조회", description = "평가자에게 배정된 프로그램별로 팀 수와 제출/임시저장 수를 집계해 반환합니다.")
    @GetMapping("/me")
    public List<EvaluatorAssignmentResponse> getEvaluatorAssignments(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return evaluationService.getEvaluatorAssignments(user.id());
    }

    @Operation(summary = "평가자 팀 목록 조회", description = "배정된 프로그램의 모든 팀과 각 팀에 대한 본인 채점 상태(미평가/임시저장/제출)를 반환합니다.")
    @GetMapping("/{assignmentId}/teams")
    public List<EvaluationTeamStatusResponse> getAssignmentTeams(
            @PathVariable Long assignmentId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return evaluationService.getAssignmentTeams(assignmentId, user.id());
    }

    @Operation(summary = "평가 화면 조회", description = "프로그램, 평가 대상 팀, 평가 질문, PDF 목록, 기존 임시저장/제출 내용을 조회합니다.")
    @GetMapping("/{assignmentId}/teams/{teamId}")
    public EvaluationViewResponse getEvaluationView(
            @PathVariable Long assignmentId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return evaluationService.getEvaluationView(assignmentId, teamId, user.id());
    }

    @Operation(summary = "평가 임시저장", description = "일부 질문만 채점되어도 임시저장할 수 있습니다.")
    @PutMapping("/{assignmentId}/teams/{teamId}/draft")
    public EvaluationSubmissionResponse saveDraft(
            @PathVariable Long assignmentId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.saveDraft(assignmentId, teamId, user.id(), request);
    }

    @Operation(summary = "평가 제출", description = "모든 평가 질문에 0~10점 점수가 있어야 최종 제출됩니다.")
    @PostMapping("/{assignmentId}/teams/{teamId}/submit")
    public EvaluationSubmissionResponse submit(
            @PathVariable Long assignmentId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.submit(assignmentId, teamId, user.id(), request);
    }
}
