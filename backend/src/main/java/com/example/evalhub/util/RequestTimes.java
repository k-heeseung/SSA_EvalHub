package com.example.evalhub.util;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.time.Instant;

public final class RequestTimes {
    public static final String RECEIVED_AT = RequestTimes.class.getName() + ".receivedAt";
    private RequestTimes() {}

    public static Instant receivedAt() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                && attributes.getRequest().getAttribute(RECEIVED_AT) instanceof Instant instant) return instant;
        // Non-HTTP calls (including jobs and tests) use the current time.
        return Instant.now();
    }
}
