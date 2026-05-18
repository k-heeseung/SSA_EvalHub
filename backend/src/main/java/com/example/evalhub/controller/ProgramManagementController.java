package com.example.evalhub.controller;

import com.example.evalhub.dto.*;
import com.example.evalhub.service.ProgramManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Program Management", description = "프로그램, 팀/팀원, 평가 질문, 심사위원, 평가 배정 관리 API")
public class ProgramManagementController {

    private final ProgramManagementService programManagementService;

    public ProgramManagementController(ProgramManagementService programManagementService) {
        this.programManagementService = programManagementService;
    }

    // 프로그램 매니저가 Module A/B 평가 프로그램을 생성한다.
    @Operation(summary = "프로그램 등록", description = "Module A/B 평가 프로그램을 생성합니다.")
    @PostMapping("/programs")
    public ProgramResponse createProgram(@RequestBody CreateProgramRequest request) {
        return programManagementService.createProgram(request);
    }

    // 관리자 화면에서 등록된 프로그램 목록을 조회한다.
    @Operation(summary = "프로그램 목록 조회")
    @GetMapping("/programs")
    public List<ProgramResponse> findPrograms() {
        return programManagementService.findPrograms();
    }

    // 프로그램에 평가 대상 팀을 등록한다. 개인 참가자도 1인 팀으로 등록한다.
    @Operation(summary = "팀/팀원 등록", description = "평가 대상 팀을 등록합니다. 개인 참가자는 participantType=INDIVIDUAL인 1인 팀으로 등록합니다.")
    @PostMapping("/programs/{programId}/teams")
    public TeamResponse createTeam(@PathVariable Long programId, @RequestBody CreateTeamRequest request) {
        return programManagementService.createTeam(programId, request);
    }

    // 프로그램별 평가 대상 목록을 조회한다.
    @Operation(summary = "팀 목록 조회", description = "프로그램에 등록된 평가 대상 팀 목록을 조회합니다.")
    @GetMapping("/programs/{programId}/teams")
    public List<TeamResponse> findTeams(@PathVariable Long programId) {
        return programManagementService.findTeams(programId);
    }

    // 평가 질문을 등록한다. 각 질문은 0~10점 점수형 항목이다.
    @Operation(summary = "평가 질문 등록", description = "0~10점으로 채점할 평가 질문을 등록합니다.")
    @PostMapping("/programs/{programId}/criteria")
    public CriterionResponse createCriterion(@PathVariable Long programId, @RequestBody CreateCriterionRequest request) {
        return programManagementService.createCriterion(programId, request);
    }

    // 프로그램 평가 화면에 표시할 질문 목록을 순서대로 조회한다.
    @Operation(summary = "평가 질문 목록 조회")
    @GetMapping("/programs/{programId}/criteria")
    public List<CriterionResponse> findCriteria(@PathVariable Long programId) {
        return programManagementService.findCriteria(programId);
    }

    // 심사위원 계정을 등록한다. 비밀번호 암호화는 인증 기능 추가 시 BCrypt로 교체한다.
    @Operation(summary = "심사위원 등록", description = "심사위원 계정을 생성합니다. 현재는 개발 초기용으로 비밀번호 암호화 전 단계입니다.")
    @PostMapping("/evaluators")
    public UserResponse createEvaluator(@RequestBody CreateEvaluatorRequest request) {
        return programManagementService.createEvaluator(request);
    }

    // 심사위원 배정 화면에서 사용할 심사위원 목록을 조회한다.
    @Operation(summary = "심사위원 목록 조회")
    @GetMapping("/evaluators")
    public List<UserResponse> findEvaluators() {
        return programManagementService.findEvaluators();
    }

    // 특정 평가 대상과 심사위원을 연결해 평가 작업을 배정한다.
    @Operation(summary = "심사위원 할당", description = "특정 평가 대상 participantId와 심사위원 evaluatorId를 연결합니다.")
    @PostMapping("/programs/{programId}/assignments")
    public AssignmentResponse createAssignment(
            @PathVariable Long programId,
            @RequestBody CreateAssignmentRequest request
    ) {
        return programManagementService.createAssignment(programId, request);
    }

    // 심사위원이 자신에게 배정된 평가 목록을 확인한다.
    @Operation(summary = "심사위원별 배정 목록 조회")
    @GetMapping("/evaluators/{evaluatorId}/assignments")
    public List<AssignmentResponse> findAssignmentsByEvaluator(@PathVariable Long evaluatorId) {
        return programManagementService.findAssignmentsByEvaluator(evaluatorId);
    }
}
