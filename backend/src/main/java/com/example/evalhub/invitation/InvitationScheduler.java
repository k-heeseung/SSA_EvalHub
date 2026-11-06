package com.example.evalhub.invitation;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class InvitationScheduler {
    private final EvaluatorInvitationService service;
    public InvitationScheduler(EvaluatorInvitationService service) { this.service = service; }
    @Scheduled(scheduler = "invitationTaskScheduler", fixedDelayString = "${evalhub.mail.poll-interval-ms:10000}", initialDelayString = "${evalhub.mail.poll-interval-ms:10000}")
    public void sendPending() { service.tick(); }
}
