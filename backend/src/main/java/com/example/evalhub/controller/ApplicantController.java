package com.example.evalhub.controller;

import com.example.evalhub.dto.*;
import com.example.evalhub.service.ApplicationService;
import com.example.evalhub.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Applicant", description = "지원자 회원가입, 지원서 작성/임시저장/제출/조회/취소 API. 지원 양식 조회는 GET /api/programs/{id}/form-fields, PDF 업로드/삭제는 팀 첨부파일 API를 재사용합니다.")
public class ApplicantController {

    private final ApplicationService applicationService;

    public ApplicantController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @Operation(summary = "지원자 회원가입", description = "MEMBER 역할의 지원자 계정을 생성합니다. 이메일이 이미 존재하면 409를 반환합니다.")
    @PostMapping("/signup")
    public UserResponse signup(@RequestBody SignupRequest request) {
        return applicationService.signup(request);
    }

    @Operation(summary = "프로그램 지원 시작(초안 생성)", description = "해당 프로그램에 대한 지원서 초안을 생성합니다. 초안 생성 시 제출 대상 팀이 함께 만들어져 PDF 첨부(팀 첨부파일 API)가 가능해집니다. 이미 지원서가 있으면 기존 지원서를 반환합니다.")
    @PostMapping("/programs/{programId}/applications")
    @PreAuthorize("hasRole('MEMBER')")
    public ApplicationDetailResponse startApplication(
            @PathVariable Long programId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody StartApplicationRequest request
    ) {
        return applicationService.startApplication(programId, user.id(), request);
    }

    @Operation(summary = "지원서 조회", description = "지원 양식 항목별 답변과 첨부파일을 포함한 지원서 전체를 조회합니다. 작성 화면과 제출 완료 화면에서 공용으로 사용합니다.")
    @GetMapping("/applications/{applicationId}")
    @PreAuthorize("hasRole('MEMBER')")
    public ApplicationDetailResponse getApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return applicationService.getApplication(applicationId, user.id());
    }

    @Operation(summary = "내 지원서 목록 조회", description = "로그인한 지원자의 지원 현황을 최근 수정순으로 조회합니다.")
    @GetMapping("/applications/me")
    @PreAuthorize("hasRole('MEMBER')")
    public List<ApplicationSummaryResponse> findMyApplications(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return applicationService.findMyApplications(user.id());
    }

    @Operation(summary = "지원서 임시저장/수정", description = "답변과 팀명을 저장합니다. 제출된 지원서를 이 API로 저장하면 다시 초안 상태가 됩니다.")
    @PutMapping("/applications/{applicationId}/draft")
    @PreAuthorize("hasRole('MEMBER')")
    public ApplicationDetailResponse saveDraft(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody SaveApplicationRequest request
    ) {
        return applicationService.saveDraft(applicationId, user.id(), request);
    }

    @Operation(summary = "지원서 제출", description = "필수 항목을 검증한 뒤 지원서를 최종 제출(SUBMITTED)합니다. 필수 항목/첨부가 비어 있으면 400을 반환합니다.")
    @PutMapping("/applications/{applicationId}/submit")
    @PreAuthorize("hasRole('MEMBER')")
    public ApplicationDetailResponse submit(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody SaveApplicationRequest request
    ) {
        return applicationService.submit(applicationId, user.id(), request);
    }

    @Operation(summary = "팀 정보 수정", description = "제출 상태를 바꾸지 않고 지원서의 팀/본인 정보(팀명·팀원·연락처)만 수정합니다. 수정 내용은 지원서에 즉시 반영됩니다.")
    @PutMapping("/applications/{applicationId}/team-info")
    @PreAuthorize("hasRole('MEMBER')")
    public ApplicationDetailResponse updateTeamInfo(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody UpdateTeamInfoRequest request
    ) {
        return applicationService.updateTeamInfo(applicationId, user.id(), request);
    }

    @Operation(summary = "지원 취소", description = "지원서와 제출 대상 팀(첨부파일 포함)을 삭제합니다.")
    @DeleteMapping("/applications/{applicationId}")
    @PreAuthorize("hasRole('MEMBER')")
    public void cancelApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        applicationService.cancelApplication(applicationId, user.id());
    }
}
