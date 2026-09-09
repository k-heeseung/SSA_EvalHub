package com.example.evalhub.scheduler;

import com.example.evalhub.service.ProgramManagementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 지원 기간(마감일)에 맞춰 프로그램 상태(접수중/평가중)를 자동으로 전환한다.
@Component
public class ProgramStatusScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProgramStatusScheduler.class);

    private final ProgramManagementService programManagementService;

    public ProgramStatusScheduler(ProgramManagementService programManagementService) {
        this.programManagementService = programManagementService;
    }

    // 서버 기동 직후 1회, 이후 매시간 실행한다. 마감일 경과 등 시간에 따른 전환을 반영한다.
    // (매니저가 기간을 직접 바꾸는 경우는 생성/수정 시점에 즉시 반영되므로, 여기서는 시간 경과만 커버한다.)
    @Scheduled(initialDelay = 0, fixedRate = 3_600_000)
    public void syncProgramStatuses() {
        int changed = programManagementService.syncProgramStatuses();
        if (changed > 0) {
            log.info("프로그램 상태 자동 전환: {}건 변경", changed);
        }
    }
}
