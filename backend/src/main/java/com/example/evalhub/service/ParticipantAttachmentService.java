package com.example.evalhub.service;

import com.example.evalhub.dto.ParticipantAttachmentResponse;
import com.example.evalhub.entity.Application;
import com.example.evalhub.entity.ParticipantAttachment;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.Team;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.repository.ApplicationRepository;
import com.example.evalhub.repository.EvaluationAssignmentRepository;
import com.example.evalhub.repository.ParticipantAttachmentRepository;
import com.example.evalhub.repository.TeamMemberRepository;
import com.example.evalhub.repository.TeamRepository;
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
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final EvaluationAssignmentRepository assignmentRepository;
    private final ApplicationRepository applicationRepository;

    public ParticipantAttachmentService(
            @Value("${evalhub.storage.attachments-path}") String attachmentsPath,
            ParticipantAttachmentRepository attachmentRepository,
            TeamRepository teamRepository,
            TeamMemberRepository teamMemberRepository,
            EvaluationAssignmentRepository assignmentRepository,
            ApplicationRepository applicationRepository
    ) {
        this.storageRoot = Path.of(attachmentsPath).toAbsolutePath().normalize();
        this.attachmentRepository = attachmentRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.assignmentRepository = assignmentRepository;
        this.applicationRepository = applicationRepository;
    }

    // PDF 파일을 로컬 저장소에 저장하고, DB에는 조회/스트리밍에 필요한 메타데이터만 남긴다.
    @Transactional
    public ParticipantAttachmentResponse upload(Long teamId, MultipartFile file, AuthenticatedUser user) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF file is empty.");
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        if (!isPdf(file, originalFilename)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files can be uploaded.");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        requireWriteAccess(team, user);
        reopenApplicationForMemberEdit(team, user);

        String storedFilename = UUID.randomUUID() + ".pdf";
        Path teamDirectory = storageRoot.resolve(String.valueOf(teamId)).normalize();
        Path target = teamDirectory.resolve(storedFilename).normalize();

        if (!target.startsWith(storageRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path.");
        }

        try {
            Files.createDirectories(teamDirectory);
            file.transferTo(target);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store PDF file.", e);
        }

        ParticipantAttachment attachment = new ParticipantAttachment(
                team,
                originalFilename,
                storedFilename,
                PDF_CONTENT_TYPE,
                file.getSize(),
                storageRoot.relativize(target).toString()
        );

        return ParticipantAttachmentResponse.from(attachmentRepository.save(attachment));
    }

    // 저장된 PDF를 Resource로 로딩한다. 컨트롤러가 inline 응답 헤더를 붙여 브라우저에 전달한다.
    @Transactional(readOnly = true)
    public AttachmentContent loadContent(Long attachmentId, AuthenticatedUser user) {
        ParticipantAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found."));
        requireReadAccess(attachment.getTeam(), user);

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

    @Transactional(readOnly = true)
    public List<ParticipantAttachmentResponse> listAttachments(Long teamId, AuthenticatedUser user) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        requireReadAccess(team, user);
        return attachmentRepository.findByTeamIdOrderByUploadedAtDesc(teamId)
                .stream()
                .map(ParticipantAttachmentResponse::from)
                .toList();
    }

    @Transactional
    public void deleteAttachment(Long attachmentId, AuthenticatedUser user) {
        ParticipantAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found."));
        requireWriteAccess(attachment.getTeam(), user);
        reopenApplicationForMemberEdit(attachment.getTeam(), user);

        Path filePath = storageRoot.resolve(attachment.getStoragePath()).normalize();
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException ignored) {
        }

        attachmentRepository.delete(attachment);
    }

    private void requireReadAccess(Team team, AuthenticatedUser user) {
        if (isManager(user.role())
                || isTeamMember(team.getId(), user.id())
                || isAssignedEvaluator(team, user)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this attachment.");
    }

    private void requireWriteAccess(Team team, AuthenticatedUser user) {
        if (isManager(user.role()) || isTeamMember(team.getId(), user.id())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot modify this attachment.");
    }

    private boolean isManager(Role role) {
        return role == Role.SUPER_ADMIN || role == Role.MANAGER;
    }

    private boolean isTeamMember(Long teamId, Long userId) {
        return teamMemberRepository.findByTeamIdAndMemberId(teamId, userId).isPresent();
    }

    private boolean isAssignedEvaluator(Team team, AuthenticatedUser user) {
        return user.role() == Role.EVALUATOR
                && isEvaluable(team)
                && assignmentRepository.findByProgramIdAndEvaluatorId(
                        team.getProgram().getId(),
                        user.id()
                ).isPresent();
    }

    private boolean isEvaluable(Team team) {
        return applicationRepository.findByTeamId(team.getId())
                .map(Application::isSubmitted)
                .orElse(true);
    }

    private void reopenApplicationForMemberEdit(Team team, AuthenticatedUser user) {
        if (user.role() != Role.MEMBER || !isTeamMember(team.getId(), user.id())) {
            return;
        }
        applicationRepository.findByTeamId(team.getId())
                .filter(Application::isSubmitted)
                .ifPresent(Application::reopen);
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
