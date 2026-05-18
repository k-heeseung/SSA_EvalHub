package com.example.evalhub.controller;

import com.example.evalhub.dto.EvaluationSubmissionResponse;
import com.example.evalhub.dto.EvaluationViewResponse;
import com.example.evalhub.dto.SaveEvaluationRequest;
import com.example.evalhub.service.EvaluationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/evaluation-assignments")
@Tag(name = "Evaluation", description = "평가 화면 조회, 임시저장, 최종 제출 API")
public class EvaluationController {

    private final EvaluationService evaluationService;

    public EvaluationController(EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    // 평가 화면 진입 시 필요한 배정 정보, 질문, PDF, 기존 임시저장 내용을 한 번에 내려준다.
    @Operation(summary = "평가 화면 조회", description = "배정 정보, 프로그램, 평가 대상, 평가 질문, PDF 목록, 기존 임시저장/제출 내용을 조회합니다.")
    @GetMapping("/{assignmentId}")
    public EvaluationViewResponse getEvaluationView(@PathVariable Long assignmentId) {
        return evaluationService.getEvaluationView(assignmentId);
    }

    // 평가자가 작성 중인 점수와 한줄평을 임시저장한다.
    @Operation(summary = "평가 임시저장", description = "일부 질문만 채점되어도 임시저장할 수 있습니다.")
    @PutMapping("/{assignmentId}/draft")
    public EvaluationSubmissionResponse saveDraft(
            @PathVariable Long assignmentId,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.saveDraft(assignmentId, request);
    }

    // 모든 질문에 점수가 입력된 경우 평가를 최종 제출한다.
    @Operation(summary = "평가 제출", description = "모든 평가 질문에 0~10점 점수가 있어야 최종 제출됩니다.")
    @PostMapping("/{assignmentId}/submit")
    public EvaluationSubmissionResponse submit(
            @PathVariable Long assignmentId,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.submit(assignmentId, request);
    }
}
