package com.example.evalhub.config;

import com.example.evalhub.service.RealtimeUpdateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

@Component
public class RealtimeUpdateInterceptor implements HandlerInterceptor {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final RealtimeUpdateService realtimeUpdateService;

    public RealtimeUpdateInterceptor(RealtimeUpdateService realtimeUpdateService) {
        this.realtimeUpdateService = realtimeUpdateService;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception
    ) {
        if (exception == null
                && MUTATING_METHODS.contains(request.getMethod())
                && response.getStatus() >= 200
                && response.getStatus() < 400
                && !request.getRequestURI().startsWith("/api/auth/")) {
            realtimeUpdateService.publishChange(request.getRequestURI());
        }
    }
}
