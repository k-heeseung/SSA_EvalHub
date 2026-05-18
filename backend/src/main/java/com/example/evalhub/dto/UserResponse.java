package com.example.evalhub.dto;

import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.Status;
import com.example.evalhub.entity.User;

public record UserResponse(
        Long id,
        String email,
        Role role,
        Status status
) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getRole(), user.getStatus());
    }
}
