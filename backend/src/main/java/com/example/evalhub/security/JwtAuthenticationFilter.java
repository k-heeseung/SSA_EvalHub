package com.example.evalhub.security;

import com.example.evalhub.entity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ACCESS_TOKEN_COOKIE = "EVALHUB_ACCESS_TOKEN";

    private final JwtService jwtService;
    private final EvalHubUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, EvalHubUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String token = findCookie(request, ACCESS_TOKEN_COOKIE);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = jwtService.parse(token);
                AuthenticatedUser user = (AuthenticatedUser) userDetailsService.loadUserByUsername(claims.getSubject());
                Long tokenUserId = claims.get("uid", Long.class);
                Role tokenRole = Role.valueOf(claims.get("role", String.class));
                if (user.isEnabled() && user.id().equals(tokenUserId) && user.role() == tokenRole) {
                    UsernamePasswordAuthenticationToken authentication =
                            UsernamePasswordAuthenticationToken.authenticated(user, token, user.getAuthorities());
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (JwtException | IllegalArgumentException ignored) {
                // Invalid and expired tokens are handled by the normal 401 entry point.
            }
        }
        filterChain.doFilter(request, response);
    }

    private String findCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
