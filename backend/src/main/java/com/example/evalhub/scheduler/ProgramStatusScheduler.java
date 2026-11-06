package com.example.evalhub.scheduler;

import com.example.evalhub.service.ProgramManagementService;
import com.example.evalhub.service.RealtimeUpdateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 지원·평가 기간에 맞춰 프로그램 상태(접수 예정/지원 접수/평가 진행/평가 완료)를 자동으로 전환한다.
@Component
public class ProgramStatusScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProgramStatusScheduler.class);

    private final ProgramManagementService programManagementService;
    private final RealtimeUpdateService realtimeUpdateService;

    public ProgramStatusScheduler(ProgramManagementService programManagementService, RealtimeUpdateService realtimeUpdateService) {
        this.programManagementService = programManagementService;
        this.realtimeUpdateService = realtimeUpdateService;
    }

    // 서버 기동 직후 1회, 이후 이전 실행 완료 30초 뒤 실행한다.
    // (매니저가 기간을 직접 바꾸는 경우는 생성/수정 시점에 즉시 반영되므로, 여기서는 시간 경과만 커버한다.)
    // 매니저가 수동으로 완료 처리한 프로그램은 여기서 다시 열지 않는다. 평가 기간을 늘리면 수정 시점에 다시 열린다.
    @Scheduled(initialDelay = 0, fixedDelay = 30_000)
    public void syncProgramStatuses() {
        int changed = programManagementService.syncProgramStatuses();
        if (changed > 0) {
            // 트랜잭션 서비스가 반환되어 커밋된 뒤 화면을 갱신한다.
            realtimeUpdateService.publishChange("/api/programs");
            log.info("프로그램 상태 자동 전환: {}건 변경", changed);
        }
    }
}
