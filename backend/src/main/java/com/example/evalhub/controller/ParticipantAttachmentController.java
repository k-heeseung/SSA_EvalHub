package com.example.evalhub.controller;

import com.example.evalhub.dto.ParticipantAttachmentResponse;
import com.example.evalhub.service.ParticipantAttachmentService;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ParticipantAttachmentController {

    private final ParticipantAttachmentService attachmentService;

    public ParticipantAttachmentController(ParticipantAttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    // 평가 대상에 PDF 자료를 업로드한다.
    @PostMapping(
            value = "/program-participants/{participantId}/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ParticipantAttachmentResponse upload(
            @PathVariable Long participantId,
            @RequestPart("file") MultipartFile file
    ) {
        return attachmentService.upload(participantId, file);
    }

    // 평가 화면에서 보여줄 PDF 목록을 조회한다.
    @GetMapping("/program-participants/{participantId}/attachments")
    public List<ParticipantAttachmentResponse> findByParticipant(@PathVariable Long participantId) {
        return attachmentService.findByParticipant(participantId);
    }

    // 브라우저 PDF 뷰어에서 바로 열 수 있도록 PDF 파일을 inline으로 스트리밍한다.
    @GetMapping("/attachments/{attachmentId}/content")
    public ResponseEntity<Resource> view(@PathVariable Long attachmentId) {
        ParticipantAttachmentService.AttachmentContent content = attachmentService.loadContent(attachmentId);

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
