package com.example.evalhub;

import com.example.evalhub.dto.SaveApplicationRequest;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.ApplicationService;
import com.example.evalhub.service.ParticipantAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class AttachmentSubmissionIntegrationTests {
    static final Path storage = Path.of(System.getProperty("java.io.tmpdir"), "evalhub-attachments-" + UUID.randomUUID());
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("evalhub.storage.attachments-path", storage::toString);
    }

    @Autowired ApplicationService service;
    @Autowired ParticipantAttachmentService attachmentService;
    @Autowired ApplicationRepository applications;
    @Autowired ParticipantAttachmentRepository attachments;
    @Autowired ApplicationFormFieldRepository fields;
    @Autowired ProgramRepository programs;
    @Autowired UserRepository users;
    @Autowired TeamRepository teams;
    Application application;
    Team team;
    User member;
    Program program;
    Path file;
    String key;

    @BeforeEach
    void setUp() throws IOException {
        String suffix = UUID.randomUUID().toString();
        User manager = users.save(new User("manager-" + suffix + "@example.com", "encoded", Role.MANAGER));
        member = users.save(new User("member-" + suffix + "@example.com", "encoded", Role.MEMBER));
        program = programs.save(new Program(manager, "attachment-test", null, ProgramType.MODULE_A,
                LocalDate.now().minusDays(1), LocalDate.now().plusDays(2),
                LocalDate.now().plusDays(3), LocalDate.now().plusDays(4), null));
        program.updateParticipantType(ParticipantType.INDIVIDUAL);
        program.updateAttachmentSettings(true, 3);
        team = teams.save(new Team(program, "applicant", ParticipantType.INDIVIDUAL, null, "applicant", null, null));
        application = applications.save(new Application(program, member, team));
        key = UUID.randomUUID() + ".pdf";
        Files.createDirectories(storage);
        file = storage.resolve(key);
    }

    @org.junit.jupiter.api.AfterEach
    void cleanFile() throws IOException { Files.deleteIfExists(file); }

    private void record() {
        attachments.save(new ParticipantAttachment(team, "test.pdf", key, "application/pdf", 4L, key));
    }

    private void submit() {
        service.submit(application.getId(), member.getId(),
                new SaveApplicationRequest(null, "지원자", null, null, List.of(), List.of()));
    }

    @Test
    void missingPhysicalFileBlocksSubmission() {
        record();
        assertThatThrownBy(this::submit).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("다시 업로드");
        assertThat(application.isSubmitted()).isFalse();
    }

    @Test
    void truncatedFileBlocksSubmission() throws IOException {
        record();
        Files.writeString(file, "%P");
        assertThatThrownBy(this::submit).isInstanceOf(ResponseStatusException.class);
        assertThat(application.isSubmitted()).isFalse();
    }

    @Test
    void directoryInsteadOfFileBlocksSubmission() throws IOException {
        record();
        Files.createDirectory(file);
        assertThatThrownBy(this::submit).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void zeroLengthAttachmentBlocksSubmission() throws IOException {
        attachments.save(new ParticipantAttachment(team, "test.pdf", key, "application/pdf", 0L, key));
        Files.write(file, new byte[0]);
        assertThatThrownBy(this::submit).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void outsideStoragePathBlocksSubmission() {
        attachments.save(new ParticipantAttachment(team, "test.pdf", key, "application/pdf", 4L, "../outside.pdf"));
        assertThatThrownBy(this::submit).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void validFileAllowsRequiredAttachmentSubmission() throws IOException {
        fields.save(new ApplicationFormField(program, "필수 PDF", "FILE", true, 1, null));
        record();
        Files.writeString(file, "%PDF");
        submit();
        assertThat(application.isSubmitted()).isTrue();
    }

    @Test
    void noFileStillRejectsRequiredAttachment() {
        fields.save(new ApplicationFormField(program, "필수 PDF", "FILE", true, 1, null));
        assertThatThrownBy(this::submit).hasMessageContaining("필수 첨부파일이 없습니다");
    }

    @Test
    void optionalAttachmentCanBeAbsent() {
        submit();
        assertThat(application.isSubmitted()).isTrue();
    }

    @Test
    void actualDatabaseRollbackRemovesUploadedFile() {
        var manager = AuthenticatedUser.from(program.getManager());
        var uploaded = attachmentService.upload(team.getId(),
                new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF".getBytes()), manager);
        var record = attachments.findById(uploaded.id()).orElseThrow();
        Path uploadedPath = storage.resolve(record.getStoragePath());
        assertThat(uploadedPath).exists();
        TestTransaction.flagForRollback();
        TestTransaction.end();
        assertThat(uploadedPath).doesNotExist();
        assertThat(attachments.findById(uploaded.id())).isEmpty();
    }

    @Test
    void actualDatabaseRollbackPreservesDeletedFile() throws IOException {
        record();
        Files.writeString(file, "%PDF");
        var record = attachments.findByTeamIdOrderByUploadedAtDesc(team.getId()).getFirst();
        attachmentService.deleteAttachment(record.getId(), AuthenticatedUser.from(program.getManager()));
        assertThat(file).exists();
        TestTransaction.flagForRollback();
        TestTransaction.end();
        assertThat(file).exists();
    }
}
