package com.example.evalhub.controller;

import com.example.evalhub.dto.ParticipantAttachmentResponse;
import com.example.evalhub.service.ParticipantAttachmentService;
import com.example.evalhub.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Participant Attachments", description = "평가 대상 PDF 첨부파일 업로드, 스트리밍 API")
public class ParticipantAttachmentController {

    private final ParticipantAttachmentService attachmentService;

    public ParticipantAttachmentController(ParticipantAttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    // 평가 대상에 PDF 자료를 업로드한다.
    @Operation(summary = "PDF 업로드", description = "평가 대상 팀에 PDF 파일을 첨부합니다. multipart/form-data의 file 필드를 사용합니다.")
    @PostMapping(
            value = "/teams/{teamId}/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER', 'MEMBER')")
    public ParticipantAttachmentResponse upload(
            @PathVariable Long teamId,
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestPart("file") MultipartFile file
    ) {
        return attachmentService.upload(teamId, file, user);
    }

    @Operation(summary = "팀 첨부파일 목록 조회")
    @GetMapping("/teams/{teamId}/attachments")
    public List<ParticipantAttachmentResponse> listAttachments(
            @PathVariable Long teamId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return attachmentService.listAttachments(teamId, user);
    }

    @Operation(summary = "첨부파일 삭제")
    @DeleteMapping("/attachments/{attachmentId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER', 'MEMBER')")
    public void deleteAttachment(
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        attachmentService.deleteAttachment(attachmentId, user);
    }

    // 브라우저 PDF 뷰어에서 바로 열 수 있도록 PDF 파일을 inline으로 스트리밍한다.
    @Operation(summary = "PDF 보기", description = "PDF 파일을 브라우저에서 바로 열 수 있도록 inline으로 스트리밍합니다.")
    @GetMapping("/attachments/{attachmentId}/content")
    public ResponseEntity<Resource> view(
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        ParticipantAttachmentService.AttachmentContent content = attachmentService.loadContent(attachmentId, user);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(content.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(content.originalFilename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(content.resource());
    }
}
