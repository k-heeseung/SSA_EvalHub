package com.example.evalhub.controller;

import com.example.evalhub.service.RealtimeUpdateService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
public class RealtimeUpdateController {

    private final RealtimeUpdateService realtimeUpdateService;

    public RealtimeUpdateController(RealtimeUpdateService realtimeUpdateService) {
        this.realtimeUpdateService = realtimeUpdateService;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        return realtimeUpdateService.subscribe();
    }
}
