package com.example.evalhub.service;

import com.example.evalhub.dto.ParticipantAttachmentResponse;
import com.example.evalhub.dto.AttachmentBatchResponse;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import com.example.evalhub.util.ProgramTimes;
import com.example.evalhub.util.RequestTimes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;

@Service
public class ParticipantAttachmentService {

    private static final Logger log = LoggerFactory.getLogger(ParticipantAttachmentService.class);

    private static final String PDF_CONTENT_TYPE = "application/pdf";

    private final Path storageRoot;
    private final AttachmentFiles attachmentFiles;
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
        this.attachmentFiles = new AttachmentFiles(attachmentsPath);
        this.attachmentRepository = attachmentRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.assignmentRepository = assignmentRepository;
        this.applicationRepository = applicationRepository;
    }

    // PDF 파일을 로컬 저장소에 저장하고, DB에는 조회/스트리밍에 필요한 메타데이터만 남긴다.
    @Transactional
    public ParticipantAttachmentResponse upload(Long teamId, MultipartFile file, AuthenticatedUser user) {
        String originalFilename = validateFile(file);

        // 같은 팀의 업로드를 직렬화하여 개수 확인과 저장 사이의 동시 요청을 막는다.
        Team team = teamRepository.findByIdForAttachmentUpload(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        requireWriteAccess(team, user);
        validateApplicationOpen(team, user);
        validateAttachmentUpload(team, 1);
        reopenApplicationForMemberEdit(team, user);

        return storeFile(team, file, originalFilename);
    }

    // A batch has one admission instant. Never recheck the clock between its files.
    @Transactional
    public AttachmentBatchResponse uploadBatch(Long teamId, List<MultipartFile> files, AuthenticatedUser user) {
        if (files == null || files.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드할 파일을 선택해주세요.");
        Team team = teamRepository.findByIdForAttachmentUpload(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        requireWriteAccess(team, user);
        validateApplicationOpen(team, user);
        validateAttachmentUpload(team, files.size());
        List<ParticipantAttachmentResponse> uploaded = new ArrayList<>();
        List<AttachmentBatchResponse.Failure> failed = new ArrayList<>();
        for (MultipartFile file : files) {
            try {
                uploaded.add(storeFile(team, file, validateFile(file)));
            } catch (ResponseStatusException error) {
                failed.add(new AttachmentBatchResponse.Failure(file.getOriginalFilename(), error.getReason()));
            }
        }
        if (!uploaded.isEmpty()) reopenApplicationForMemberEdit(team, user);
        return new AttachmentBatchResponse(uploaded, failed);
    }

    private String validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF file is empty.");
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        if (!isPdf(file, originalFilename)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files can be uploaded.");
        }

        return originalFilename;
    }

    private ParticipantAttachmentResponse storeFile(Team team, MultipartFile file, String originalFilename) {
        String storedFilename = UUID.randomUUID() + ".pdf";
        Path teamDirectory = storageRoot.resolve(String.valueOf(team.getId())).normalize();
        Path target = teamDirectory.resolve(storedFilename).normalize();

        if (!target.startsWith(storageRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path.");
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) deleteStoredFile(target);
                    else if (status == STATUS_UNKNOWN) log.error("Attachment transaction outcome unknown: {}", target);
                }
            });
        }
        try {
            Files.createDirectories(teamDirectory);
            file.transferTo(target);
        } catch (IOException | RuntimeException e) {
            deleteStoredFile(target);
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

        try {
            return ParticipantAttachmentResponse.from(attachmentRepository.save(attachment));
        } catch (RuntimeException error) {
            deleteStoredFile(target);
            throw error;
        }
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
        teamRepository.findByIdForAttachmentUpload(attachment.getTeam().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        requireWriteAccess(attachment.getTeam(), user);
        validateApplicationOpen(attachment.getTeam(), user);
        reopenApplicationForMemberEdit(attachment.getTeam(), user);

        Path filePath = attachmentFiles.resolve(attachment.getStoragePath());
        attachmentRepository.delete(attachment);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { deleteStoredFile(filePath); }
            });
        } else {
            deleteStoredFile(filePath);
        }
    }

    private void deleteStoredFile(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException | RuntimeException error) {
            // Cleanup failure must never turn an already committed DB operation into an API failure.
            log.error("Failed to clean up attachment file: {}", path, error);
        }
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

    private void validateAttachmentUpload(Team team, int additionalCount) {
        if (!team.getProgram().isAttachmentsEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "첨부파일을 사용할 수 없는 프로그램입니다.");
        }
        Integer configuredMax = team.getProgram().getMaxAttachments();
        int maxAttachments = configuredMax == null ? 1 : configuredMax;
        if (attachmentRepository.countByTeamId(team.getId()) + additionalCount > maxAttachments) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "첨부파일은 최대 " + maxAttachments + "개까지 업로드할 수 있습니다.");
        }
    }

    // 지원 기간 내에만 지원자의 첨부 변경을 허용한다. 관리자 수정은 계속 허용한다.
    private void validateApplicationOpen(Team team, AuthenticatedUser user) {
        if (user.role() != Role.MEMBER) {
            return;
        }
        Instant deadline = ProgramTimes.applicationDeadline(team.getProgram());
        Instant now = RequestTimes.receivedAt();
        Instant start = ProgramTimes.applicationStart(team.getProgram());
        if (start != null && now.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원 시작 시각 이전에는 첨부파일을 변경할 수 없습니다.");
        }
        if (deadline != null && !now.isBefore(deadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "지원 마감 시각이 지나 첨부파일을 변경할 수 없습니다.");
        }
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
