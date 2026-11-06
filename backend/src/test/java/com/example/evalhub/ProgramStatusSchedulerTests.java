package com.example.evalhub;

import com.example.evalhub.scheduler.ProgramStatusScheduler;
import com.example.evalhub.service.ProgramManagementService;
import com.example.evalhub.service.RealtimeUpdateService;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProgramStatusSchedulerTests {
    private final ProgramManagementService programs = mock(ProgramManagementService.class);
    private final RealtimeUpdateService realtime = mock(RealtimeUpdateService.class);
    private final ProgramStatusScheduler scheduler = new ProgramStatusScheduler(programs, realtime);

    @Test
    void publishesOnlyAfterStatusChangesReturn() {
        when(programs.syncProgramStatuses()).thenReturn(2);
        scheduler.syncProgramStatuses();
        var order = inOrder(programs, realtime);
        order.verify(programs).syncProgramStatuses();
        order.verify(realtime).publishChange("/api/programs");
    }

    @Test
    void unchangedStatusesDoNotRefreshScreens() {
        when(programs.syncProgramStatuses()).thenReturn(0);
        scheduler.syncProgramStatuses();
        verifyNoInteractions(realtime);
    }

    @Test
    void failedSyncDoesNotPublishUncommittedChanges() {
        when(programs.syncProgramStatuses()).thenThrow(new IllegalStateException("rollback"));
        assertThatThrownBy(scheduler::syncProgramStatuses).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(realtime);
    }

    @Test
    void runsAtStartupThenThirtySecondsAfterCompletion() throws Exception {
        var schedule = ProgramStatusScheduler.class.getMethod("syncProgramStatuses").getAnnotation(Scheduled.class);
        assertThat(schedule.initialDelay()).isZero();
        assertThat(schedule.fixedDelay()).isEqualTo(30_000);
        assertThat(schedule.fixedRate()).isEqualTo(-1);
    }
}
