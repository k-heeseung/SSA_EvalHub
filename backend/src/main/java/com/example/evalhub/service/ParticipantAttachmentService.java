package com.example.evalhub.service;

import com.example.evalhub.dto.ParticipantAttachmentResponse;
import com.example.evalhub.entity.ParticipantAttachment;
import com.example.evalhub.entity.ProgramParticipant;
import com.example.evalhub.repository.ParticipantAttachmentRepository;
import com.example.evalhub.repository.ProgramParticipantRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ParticipantAttachmentService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";

    private final Path storageRoot;
    private final ParticipantAttachmentRepository attachmentRepository;
    private final ProgramParticipantRepository participantRepository;

    public ParticipantAttachmentService(
            @Value("${evalhub.storage.attachments-path}") String attachmentsPath,
            ParticipantAttachmentRepository attachmentRepository,
            ProgramParticipantRepository participantRepository
    ) {
        this.storageRoot = Path.of(attachmentsPath).toAbsolutePath().normalize();
        this.attachmentRepository = attachmentRepository;
        this.participantRepository = participantRepository;
    }

    // PDF 파일을 로컬 저장소에 저장하고, DB에는 조회/스트리밍에 필요한 메타데이터만 남긴다.
    @Transactional
    public ParticipantAttachmentResponse upload(Long participantId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF file is empty.");
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        if (!isPdf(file, originalFilename)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files can be uploaded.");
        }

        ProgramParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Participant not found."));

        String storedFilename = UUID.randomUUID() + ".pdf";
        Path participantDirectory = storageRoot.resolve(String.valueOf(participantId)).normalize();
        Path target = participantDirectory.resolve(storedFilename).normalize();

        if (!target.startsWith(storageRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path.");
        }

        try {
            Files.createDirectories(participantDirectory);
            file.transferTo(target);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store PDF file.", e);
        }

        ParticipantAttachment attachment = new ParticipantAttachment(
                participant,
                originalFilename,
                storedFilename,
                PDF_CONTENT_TYPE,
                file.getSize(),
                storageRoot.relativize(target).toString()
        );

        return ParticipantAttachmentResponse.from(attachmentRepository.save(attachment));
    }

    // 평가 대상에 연결된 PDF 목록을 최신 업로드 순으로 반환한다.
    @Transactional(readOnly = true)
    public List<ParticipantAttachmentResponse> findByParticipant(Long participantId) {
        if (!participantRepository.existsById(participantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Participant not found.");
        }

        return attachmentRepository.findByParticipantIdOrderByUploadedAtDesc(participantId).stream()
                .map(ParticipantAttachmentResponse::from)
                .toList();
    }

    // 저장된 PDF를 Resource로 로딩한다. 컨트롤러가 inline 응답 헤더를 붙여 브라우저에 전달한다.
    @Transactional(readOnly = true)
    public AttachmentContent loadContent(Long attachmentId) {
        ParticipantAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found."));

        Path filePath = storageRoot.resolve(attachment.getStoragePath()).normalize();
        if (!filePath.startsWith(storageRoot) || !Files.exists(filePath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "PDF file not found.");
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            return new AttachmentContent(
                    resource,
                    attachment.getOriginalFilename(),
                    attachment.getContentType(),
                    attachment.getFileSize(),
                    attachment.getUploadedAt()
            );
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load PDF file.", e);
        }
    }

    // 브라우저/클라이언트가 content type을 누락할 수 있어 확장자도 함께 확인한다.
    private boolean isPdf(MultipartFile file, String originalFilename) {
        return PDF_CONTENT_TYPE.equalsIgnoreCase(file.getContentType())
                || originalFilename.toLowerCase().endsWith(".pdf");
    }

    // 업로드 파일명에 포함된 경로 정보를 제거해 파일명만 보관한다.
    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "document.pdf";
        }
        return Path.of(filename).getFileName().toString();
    }

    public record AttachmentContent(
            Resource resource,
            String originalFilename,
            String contentType,
            Long fileSize,
            LocalDateTime uploadedAt
    ) {
    }
}
