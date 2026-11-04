package com.example.evalhub;

import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.ParticipantAttachmentService;
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
import java.util.Optional;

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
        when(teams.findById(1L)).thenReturn(Optional.of(team));
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
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now().minusDays(1));

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
                ? null : LocalDate.now().plusDays(daysUntilDeadline));

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
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now().minusDays(1));

        service.upload(1L, pdf(), user(role));
        service.deleteAttachment(3L, user(role));

        verify(attachments).save(any());
        verify(attachments).delete(attachment);
        verifyNoInteractions(applications);
    }

    @Test
    void otherTeamMemberIsForbiddenEvenAfterDeadline() {
        when(members.findByTeamIdAndMemberId(1L, 2L)).thenReturn(Optional.empty());
        when(program.getApplicationDeadline()).thenReturn(LocalDate.now().minusDays(1));

        assertRejected(() -> service.upload(1L, pdf(), member), HttpStatus.FORBIDDEN);
        assertRejected(() -> service.deleteAttachment(3L, member), HttpStatus.FORBIDDEN);
        verifyNoInteractions(applications);
        verify(attachments, never()).save(any());
        verify(attachments, never()).delete(any());
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
