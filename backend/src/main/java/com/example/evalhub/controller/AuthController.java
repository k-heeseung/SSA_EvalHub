package com.example.evalhub.controller;

import com.example.evalhub.dto.ChangePasswordRequest;
import com.example.evalhub.dto.LoginRequest;
import com.example.evalhub.dto.UserResponse;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.UserRepository;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.security.JwtAuthenticationFilter;
import com.example.evalhub.security.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final boolean secureCookie;
    private final int accessTokenMinutes;
    private final int rememberedTokenDays;

    public AuthController(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            @Value("${evalhub.security.secure-cookie:false}") boolean secureCookie,
            @Value("${evalhub.security.access-token-minutes:30}") int accessTokenMinutes,
            @Value("${evalhub.security.remembered-token-days:30}") int rememberedTokenDays
    ) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.secureCookie = secureCookie;
        this.accessTokenMinutes = accessTokenMinutes;
        this.rememberedTokenDays = rememberedTokenDays;
    }

    @PostMapping("/login")
    public UserResponse login(
            @RequestBody LoginRequest request,
            HttpServletResponse httpResponse
    ) {
        if (request.email() == null || request.email().isBlank()
                || request.password() == null || request.password().isBlank()
                || request.role() == null) {
            throw unauthorized();
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            request.email().trim(),
                            request.password()
                    )
            );
            AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
            if (!isRoleCompatible(request.role(), principal.role())) {
                throw unauthorized();
            }

            Duration lifetime = Boolean.TRUE.equals(request.rememberMe())
                    ? Duration.ofDays(rememberedTokenDays)
                    : Duration.ofMinutes(accessTokenMinutes);
            String token = jwtService.createAccessToken(principal, lifetime);
            httpResponse.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie
                    .from(JwtAuthenticationFilter.ACCESS_TOKEN_COOKIE, token)
                    .httpOnly(true)
                    .secure(secureCookie)
                    .sameSite("Lax")
                    .path("/")
                    .maxAge(lifetime)
                    .build()
                    .toString());

            return userRepository.findById(principal.id())
                    .map(UserResponse::from)
                    .orElseThrow(this::unauthorized);
        } catch (AuthenticationException exception) {
            throw unauthorized();
        }
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw unauthorized();
        }
        return userRepository.findById(principal.id())
                .map(UserResponse::from)
                .orElseThrow(this::unauthorized);
    }

    // 로그인한 본인이 자신의 비밀번호를 변경한다. 모든 역할(관리자/매니저/심사위원/지원자) 공용.
    @PutMapping("/password")
    public void changePassword(
            Authentication authentication,
            @RequestBody ChangePasswordRequest request
    ) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw unauthorized();
        }
        User user = userRepository.findById(principal.id()).orElseThrow(this::unauthorized);

        String current = request.currentPassword();
        String next = request.newPassword();
        if (current == null || current.isBlank() || next == null || next.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호와 새 비밀번호를 입력해주세요.");
        }
        if (!passwordEncoder.matches(current, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
        }
        if (next.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "새 비밀번호는 8자 이상이어야 합니다.");
        }
        if (passwordEncoder.matches(next, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "새 비밀번호가 기존 비밀번호와 동일합니다.");
        }

        user.changePassword(passwordEncoder.encode(next));
        userRepository.save(user);
    }

    private boolean isRoleCompatible(Role requestedRole, Role actualRole) {
        return requestedRole == actualRole
                || (requestedRole == Role.MANAGER && actualRole == Role.SUPER_ADMIN);
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "아이디, 비밀번호 또는 역할이 올바르지 않습니다."
        );
    }
}
