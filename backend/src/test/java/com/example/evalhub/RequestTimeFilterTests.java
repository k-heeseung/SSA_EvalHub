package com.example.evalhub;

import com.example.evalhub.config.RequestTimeFilter;
import com.example.evalhub.util.RequestTimes;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.time.Instant;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RequestTimeFilterTests {
    @Test
    void serverReceiptTimeSurvivesLaterProcessingAndIgnoresClientHeaders() throws Exception {
        var before = Instant.parse("2030-11-20T08:59:59Z");
        var later = before.plusSeconds(120);
        var request = new MockHttpServletRequest();
        request.addHeader("X-Request-Time", "2000-01-01T00:00:00Z");
        var previous = RequestContextHolder.getRequestAttributes();
        try (var clock = mockStatic(Instant.class, CALLS_REAL_METHODS)) {
            clock.when(Instant::now).thenReturn(before);
            new RequestTimeFilter().doFilter(request, new MockHttpServletResponse(), (req, response) -> {
                clock.when(Instant::now).thenReturn(later);
                RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
                assertThat(RequestTimes.receivedAt()).isEqualTo(before);
                assertThat(Instant.now()).isEqualTo(later);
            });
        } finally {
            RequestContextHolder.setRequestAttributes(previous);
        }
    }

    @Test
    void directServiceCallsFallBackToTheirInvocationTime() {
        var previous = RequestContextHolder.getRequestAttributes();
        RequestContextHolder.resetRequestAttributes();
        var now = Instant.parse("2030-11-20T09:00:00Z");
        try (var clock = mockStatic(Instant.class, CALLS_REAL_METHODS)) {
            clock.when(Instant::now).thenReturn(now);
            assertThat(RequestTimes.receivedAt()).isEqualTo(now);
        } finally { RequestContextHolder.setRequestAttributes(previous); }
    }
}
