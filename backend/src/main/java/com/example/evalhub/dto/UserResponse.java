package com.example.evalhub.dto;

import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.Status;
import com.example.evalhub.entity.User;

public record UserResponse(
        Long id,
        String email,
        Role role,
        Status status,
        String name,
        String phone,
        String department,
        long assignmentCount
) {

    public static UserResponse from(User user) {
        return from(user, 0L);
    }

    public static UserResponse from(User user, long assignmentCount) {
        return new UserResponse(user.getId(), user.getEmail(), user.getRole(), user.getStatus(), user.getName(), user.getPhone(), user.getDepartment(), assignmentCount);
    }
}
