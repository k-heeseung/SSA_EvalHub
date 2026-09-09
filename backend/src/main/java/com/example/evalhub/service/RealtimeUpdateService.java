package com.example.evalhub.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RealtimeUpdateService {

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        send(emitter, "connected", Map.of("connected", true));
        return emitter;
    }

    public void publishChange(String path) {
        broadcast("change", Map.of("path", path));
    }

    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        broadcast("heartbeat", Map.of("timestamp", System.currentTimeMillis()));
    }

    private void broadcast(String eventName, Object data) {
        emitters.forEach(emitter -> send(emitter, eventName, data));
    }

    private void send(SseEmitter emitter, String eventName, Object data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(data));
        } catch (IOException | IllegalStateException exception) {
            emitters.remove(emitter);
            emitter.complete();
        }
    }
}
