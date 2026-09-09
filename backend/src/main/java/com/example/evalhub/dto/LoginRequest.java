package com.example.evalhub.dto;

import com.example.evalhub.entity.Role;

public record LoginRequest(
        String email,
        String password,
        Role role,
        Boolean rememberMe
) {
}
