package com.example.evalhub.controller;

import com.example.evalhub.dto.EvaluationSubmissionResponse;
import com.example.evalhub.dto.EvaluationViewResponse;
import com.example.evalhub.dto.SaveEvaluationRequest;
import com.example.evalhub.service.EvaluationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/evaluation-assignments")
public class EvaluationController {

    private final EvaluationService evaluationService;

    public EvaluationController(EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    // 평가 화면 진입 시 필요한 배정 정보, 질문, PDF, 기존 임시저장 내용을 한 번에 내려준다.
    @GetMapping("/{assignmentId}")
    public EvaluationViewResponse getEvaluationView(@PathVariable Long assignmentId) {
        return evaluationService.getEvaluationView(assignmentId);
    }

    // 평가자가 작성 중인 점수와 한줄평을 임시저장한다.
    @PutMapping("/{assignmentId}/draft")
    public EvaluationSubmissionResponse saveDraft(
            @PathVariable Long assignmentId,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.saveDraft(assignmentId, request);
    }

    // 모든 질문에 점수가 입력된 경우 평가를 최종 제출한다.
    @PostMapping("/{assignmentId}/submit")
    public EvaluationSubmissionResponse submit(
            @PathVariable Long assignmentId,
            @RequestBody SaveEvaluationRequest request
    ) {
        return evaluationService.submit(assignmentId, request);
    }
}
