package com.example.evalhub.config;

import com.example.evalhub.util.RequestTimes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.time.Instant;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTimeFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getAttribute(RequestTimes.RECEIVED_AT) == null)
            request.setAttribute(RequestTimes.RECEIVED_AT, Instant.now());
        chain.doFilter(request, response);
    }
}
