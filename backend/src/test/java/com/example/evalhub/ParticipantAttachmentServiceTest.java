package com.example.evalhub;

import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.ParticipantAttachmentService;
import com.example.evalhub.util.ProgramTimes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ParticipantAttachmentServiceTest {
    @TempDir Path storage;
    private ParticipantAttachmentRepository attachments;
    private TeamRepository teams;
    private TeamMemberRepository members;
    private ApplicationRepository applications;
    private ParticipantAttachmentService service;
    private Team team;
    private Program program;
    private Application application;
    private AuthenticatedUser member;
    private ParticipantAttachment attachment;

    @BeforeEach
    void setUp() throws Exception {
        attachments = mock(ParticipantAttachmentRepository.class);
        teams = mock(TeamRepository.class);
        members = mock(TeamMemberRepository.class);
        applications = mock(ApplicationRepository.class);
        service = new ParticipantAttachmentService(storage.toString(), attachments, teams, members,
                mock(EvaluationAssignmentRepository.class), applications);
        team = mock(Team.class);
        program = mock(Program.class);
        application = mock(Application.class);
        member = user(Role.MEMBER);
        when(team.getId()).thenReturn(1L);
        when(team.getProgram()).thenReturn(program);
        when(teams.findByIdForAttachmentUpload(1L)).thenReturn(Optional.of(team));
        when(program.isAttachmentsEnabled()).thenReturn(true);
        when(program.getMaxAttachments()).thenReturn(2);
        when(members.findByTeamIdAndMemberId(1L, 2L)).thenReturn(Optional.of(mock(TeamMember.class)));
        when(applications.findByTeamId(1L)).thenReturn(Optional.of(application));
        when(application.isSubmitted()).thenReturn(true);
        when(attachments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        attachment = new ParticipantAttachment(team, "old.pdf", "old.pdf", "application/pdf", 4L, "old.pdf");
        when(attachments.findById(3L)).thenReturn(Optional.of(attachment));
        Files.writeString(storage.resolve("old.pdf"), "%PDF");
    }

    @Test
    void expiredUploadAndDeleteLeaveFilesAndSubmissionUntouched() throws Exception {
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now(ProgramTimes.ZONE).minusDays(1));

        assertRejected(() -> service.upload(1L, pdf(), member), HttpStatus.BAD_REQUEST);
        assertRejected(() -> service.deleteAttachment(3L, member), HttpStatus.BAD_REQUEST);

        verifyNoInteractions(applications);
        verify(application, never()).reopen();
        verify(attachments, never()).save(any());
        verify(attachments, never()).delete(any());
        assertThat(Files.readString(storage.resolve("old.pdf"))).isEqualTo("%PDF");
        assertThat(Files.exists(storage.resolve("1"))).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {0, 1})
    void memberCanChangeAttachmentsThroughDeadlineOrWithoutDeadline(Integer daysUntilDeadline) {
        when(program.getApplicationDeadline()).thenReturn(daysUntilDeadline == null
                ? null : LocalDate.now(ProgramTimes.ZONE).plusDays(daysUntilDeadline));

        service.upload(1L, pdf(), member);
        service.deleteAttachment(3L, member);

        verify(attachments).save(any());
        verify(attachments).delete(attachment);
        verify(application, times(2)).reopen();
        assertThat(storage.resolve("old.pdf")).doesNotExist();
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MANAGER", "SUPER_ADMIN"})
    void administratorsCanChangeAttachmentsAfterDeadline(Role role) {
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now(ProgramTimes.ZONE).minusDays(1));

        service.upload(1L, pdf(), user(role));
        service.deleteAttachment(3L, user(role));

        verify(attachments).save(any());
        verify(attachments).delete(attachment);
        verifyNoInteractions(applications);
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MANAGER", "SUPER_ADMIN"})
    void administratorsCanChangeAttachmentsBeforePreciseStart(Role role) {
        when(program.getApplicationStartAt()).thenReturn(Instant.now().plusSeconds(3600));
        service.upload(1L, pdf(), user(role));
        service.deleteAttachment(3L, user(role));
        verify(attachments).save(any());
        verify(attachments).delete(attachment);
        verifyNoInteractions(applications);
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MANAGER", "SUPER_ADMIN"})
    void administratorsStillRespectDisabledAttachmentsAfterPreciseDeadline(Role role) {
        when(program.getApplicationDeadlineAt()).thenReturn(Instant.now().minusSeconds(1));
        when(program.isAttachmentsEnabled()).thenReturn(false);
        assertRejected(() -> service.upload(1L, pdf(), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MANAGER", "SUPER_ADMIN"})
    void administratorsStillRespectMaximumAfterPreciseDeadline(Role role) {
        when(program.getApplicationDeadlineAt()).thenReturn(Instant.now().minusSeconds(1));
        when(attachments.countByTeamId(1L)).thenReturn(2L);
        assertRejected(() -> service.upload(1L, pdf(), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @Test
    void otherTeamMemberIsForbiddenEvenAfterDeadline() {
        when(members.findByTeamIdAndMemberId(1L, 2L)).thenReturn(Optional.empty());
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now(ProgramTimes.ZONE).minusDays(1));

        assertRejected(() -> service.upload(1L, pdf(), member), HttpStatus.FORBIDDEN);
        assertRejected(() -> service.deleteAttachment(3L, member), HttpStatus.FORBIDDEN);
        verifyNoInteractions(applications);
        verify(attachments, never()).save(any());
        verify(attachments, never()).delete(any());
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MEMBER", "MANAGER", "SUPER_ADMIN"})
    void disabledAttachmentsRejectUploadWithoutChangingState(Role role) {
        when(program.isAttachmentsEnabled()).thenReturn(false);
        assertRejected(() -> service.upload(1L, pdf(), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MEMBER", "MANAGER", "SUPER_ADMIN"})
    void limitRejectsUploadWithoutChangingState(Role role) {
        when(attachments.countByTeamId(1L)).thenReturn(2L);
        assertRejected(() -> service.upload(1L, pdf(), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @Test
    void uploadBelowLimitUsesTeamLockBeforeCountingAndSaving() {
        when(attachments.countByTeamId(1L)).thenReturn(1L);
        service.upload(1L, pdf(), member);
        var order = inOrder(teams, attachments);
        order.verify(teams).findByIdForAttachmentUpload(1L);
        order.verify(attachments).countByTeamId(1L);
        order.verify(attachments).save(any());
    }

    @Test
    void missingLimitDefaultsToOne() {
        when(program.getMaxAttachments()).thenReturn(null);
        when(attachments.countByTeamId(1L)).thenReturn(1L);
        assertRejected(() -> service.upload(1L, pdf(), member), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @Test
    void deletionRemainsAllowedWhenAttachmentsDisabledAndOverLimit() {
        when(program.isAttachmentsEnabled()).thenReturn(false);
        service.deleteAttachment(3L, member);
        verify(attachments).delete(attachment);
        assertThat(storage.resolve("old.pdf")).doesNotExist();
    }

    @Test
    void batchCompletesBothFilesWhenClockCrossesDeadlineDuringFirstSave() {
        var receipt = Instant.parse("2030-11-20T08:59:59Z");
        var later = receipt.plusSeconds(120);
        when(program.getApplicationStartAt()).thenReturn(receipt.minusSeconds(60));
        when(program.getApplicationDeadlineAt()).thenReturn(receipt.plusSeconds(1));
        try (var clock = mockStatic(Instant.class, CALLS_REAL_METHODS)) {
            clock.when(Instant::now).thenReturn(receipt);
            when(attachments.save(any())).thenAnswer(invocation -> {
                clock.when(Instant::now).thenReturn(later);
                return invocation.getArgument(0);
            });
            var result = service.uploadBatch(1L, List.of(pdf(), pdf()), member);
            assertThat(result.uploaded()).hasSize(2);
            assertThat(result.failed()).isEmpty();
            verify(attachments, times(2)).save(any());
            verify(attachments).countByTeamId(1L);
        }
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MEMBER", "MANAGER", "SUPER_ADMIN"})
    void batchCountIncludesAllSelectedFilesForEveryRole(Role role) {
        when(attachments.countByTeamId(1L)).thenReturn(1L);
        assertRejected(() -> service.uploadBatch(1L, List.of(pdf(), pdf()), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MEMBER", "MANAGER", "SUPER_ADMIN"})
    void batchRespectsDisabledAttachmentsForEveryRole(Role role) {
        when(program.isAttachmentsEnabled()).thenReturn(false);
        assertRejected(() -> service.uploadBatch(1L, List.of(pdf()), user(role)), HttpStatus.BAD_REQUEST);
        assertUploadDidNotChangeState();
    }

    @Test
    void batchReportsInvalidFileAndKeepsSuccessfulFile() {
        var invalid = new MockMultipartFile("files", "bad.txt", "text/plain", "bad".getBytes());
        var result = service.uploadBatch(1L, List.of(invalid, pdf()), member);
        assertThat(result.uploaded()).hasSize(1);
        assertThat(result.failed()).hasSize(1);
        assertThat(result.failed().getFirst().name()).isEqualTo("bad.txt");
        verify(application).reopen();
    }

    @Test
    void uploadFilesAreRemovedOnTransactionRollback() throws Exception {
        withSynchronization(() -> {
            service.uploadBatch(1L, List.of(pdf(), pdf()), member);
            assertThat(storedFiles()).hasSize(2);
            complete(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            assertThat(storedFiles()).isEmpty();
        });
    }

    @Test
    void uploadedFileSurvivesCommit() throws Exception {
        withSynchronization(() -> {
            service.upload(1L, pdf(), member);
            complete(org.springframework.transaction.support.TransactionSynchronization.STATUS_COMMITTED);
            assertThat(storedFiles()).hasSize(1);
        });
    }

    @Test
    void databaseSaveFailureRemovesUploadedFile() throws Exception {
        when(attachments.save(any())).thenThrow(new IllegalStateException("DB unavailable"));
        assertThatThrownBy(() -> service.upload(1L, pdf(), member)).isInstanceOf(IllegalStateException.class);
        assertThat(storedFiles()).isEmpty();
    }

    @Test
    void partiallyWrittenFailedUploadIsRemoved() throws Exception {
        var broken = new MockMultipartFile("file", "broken.pdf", "application/pdf", "%PDF".getBytes()) {
            @Override
            public void transferTo(Path path) throws java.io.IOException {
                Files.writeString(path, "partial");
                throw new java.io.IOException("disk full");
            }
        };
        assertRejected(() -> service.upload(1L, broken, member), HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(storedFiles()).isEmpty();
        verify(attachments, never()).save(any());
    }

    @Test
    void deletionWaitsForCommitAndRollbackPreservesFile() throws Exception {
        withSynchronization(() -> {
            service.deleteAttachment(3L, member);
            assertThat(storage.resolve("old.pdf")).exists();
            complete(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            assertThat(storage.resolve("old.pdf")).exists();
        });
    }

    @Test
    void deletionRunsAfterCommit() throws Exception {
        withSynchronization(() -> {
            service.deleteAttachment(3L, member);
            assertThat(storage.resolve("old.pdf")).exists();
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) {
                callback.afterCommit();
            }
            assertThat(storage.resolve("old.pdf")).doesNotExist();
        });
    }

    @Test
    void databaseDeleteFailurePreservesFile() {
        doThrow(new IllegalStateException("DB unavailable")).when(attachments).delete(any());
        assertThatThrownBy(() -> service.deleteAttachment(3L, member)).isInstanceOf(IllegalStateException.class);
        assertThat(storage.resolve("old.pdf")).exists();
    }

    @Test
    void deletionRejectsPathOutsideStorage() {
        when(attachments.findById(3L)).thenReturn(Optional.of(
                new ParticipantAttachment(team, "bad.pdf", "bad.pdf", "application/pdf", 4L, "../outside.pdf")));
        assertThatThrownBy(() -> service.deleteAttachment(3L, member)).isInstanceOf(IllegalArgumentException.class);
        verify(attachments, never()).delete(any());
    }

    private List<Path> storedFiles() throws Exception {
        if (!Files.exists(storage.resolve("1"))) return List.of();
        try (var paths = Files.list(storage.resolve("1"))) { return paths.toList(); }
    }

    private void complete(int status) {
        for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) {
            callback.afterCompletion(status);
        }
    }

    private void withSynchronization(CheckedAction action) throws Exception {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try { action.run(); }
        finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
    }

    @FunctionalInterface
    interface CheckedAction { void run() throws Exception; }

    private void assertUploadDidNotChangeState() {
        verifyNoInteractions(applications);
        verify(attachments, never()).save(any());
        verify(attachments, never()).delete(any());
        assertThat(storage.resolve("old.pdf")).exists();
        assertThat(storage.resolve("1")).doesNotExist();
    }

    private AuthenticatedUser user(Role role) {
        AuthenticatedUser user = mock(AuthenticatedUser.class);
        when(user.id()).thenReturn(2L);
        when(user.role()).thenReturn(role);
        return user;
    }

    private MockMultipartFile pdf() {
        return new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF".getBytes());
    }

    private void assertRejected(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode()).isEqualTo(status));
    }
}
