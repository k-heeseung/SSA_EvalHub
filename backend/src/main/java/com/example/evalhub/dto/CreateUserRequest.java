package com.example.evalhub.dto;

import com.example.evalhub.entity.Role;

public record CreateUserRequest(
        String email,
        String password,
        Role role,
        String name,
        String department
) {
}
