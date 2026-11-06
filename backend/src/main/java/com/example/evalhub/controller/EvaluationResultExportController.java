package com.example.evalhub.controller;

import com.example.evalhub.service.EvaluationResultsPdfService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/programs")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER')")
public class EvaluationResultExportController {
    private final EvaluationResultsPdfService pdfService;

    public EvaluationResultExportController(EvaluationResultsPdfService pdfService) {
        this.pdfService = pdfService;
    }

    @GetMapping(value = "/{programId}/evaluation-results/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> download(@PathVariable Long programId,
                                          @RequestParam(defaultValue = "false") boolean onlyPassed) {
        var file = pdfService.export(programId, onlyPassed);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .body(file.bytes());
    }
}
