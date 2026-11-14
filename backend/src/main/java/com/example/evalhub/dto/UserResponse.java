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
        long assignmentCount,
        boolean deleted
) {

    public static UserResponse from(User user) {
        return from(user, 0L);
    }

    public static UserResponse from(User user, long assignmentCount) {
        return new UserResponse(user.getId(), user.getDisplayEmail(), user.getRole(), user.getStatus(), user.getDisplayName(),
                user.isDeleted() ? null : user.getPhone(), user.isDeleted() ? null : user.getDepartment(), assignmentCount, user.isDeleted());
    }
}
