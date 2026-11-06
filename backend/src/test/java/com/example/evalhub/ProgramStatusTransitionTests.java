package com.example.evalhub;

import com.example.evalhub.entity.Program;
import com.example.evalhub.entity.ProgramType;
import com.example.evalhub.entity.Status;
import com.example.evalhub.repository.ProgramRepository;
import com.example.evalhub.service.ProgramManagementService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgramStatusTransitionTests {
    @Mock ProgramRepository repository;
    @InjectMocks ProgramManagementService service;

    private Program program(long start, long applicationEnd, long evaluationStart, long evaluationEnd) {
        var program = new Program(null, "schedule", null, ProgramType.MODULE_A, null, null, null, null, null);
        var now = Instant.now();
        program.updateSchedule(now.plusSeconds(start), now.plusSeconds(applicationEnd),
                now.plusSeconds(evaluationStart), now.plusSeconds(evaluationEnd));
        program.changeStatus(Status.RECRUITING);
        return program;
    }

    @Test
    void transitionsThroughAllPeriodsWithinTheSameCalendarDay() {
        var scheduled = program(60, 120, 180, 240);
        var recruiting = program(-60, 60, 120, 180);
        var pending = program(-120, -60, 60, 120);
        var active = program(-180, -120, -60, 60);
        var closed = program(-240, -180, -120, -60);
        when(repository.findAll()).thenReturn(List.of(scheduled, recruiting, pending, active, closed));
        assertThat(service.syncProgramStatuses()).isEqualTo(4);
        assertThat(List.of(scheduled.getStatus(), recruiting.getStatus(), pending.getStatus(), active.getStatus(), closed.getStatus()))
                .containsExactly(Status.SCHEDULED, Status.RECRUITING, Status.PENDING_EVALUATION, Status.ACTIVE, Status.INACTIVE);
        assertThat(service.syncProgramStatuses()).isZero();
    }

    @Test
    void draftsAndManuallyClosedProgramsRemainUnchanged() {
        var draft = program(-180, -120, -60, 60);
        draft.changeStatus(Status.DRAFT);
        var closed = program(-180, -120, -60, 60);
        closed.changeStatus(Status.INACTIVE);
        when(repository.findAll()).thenReturn(List.of(draft, closed));
        assertThat(service.syncProgramStatuses()).isZero();
        assertThat(draft.getStatus()).isEqualTo(Status.DRAFT);
        assertThat(closed.getStatus()).isEqualTo(Status.INACTIVE);
    }
}
