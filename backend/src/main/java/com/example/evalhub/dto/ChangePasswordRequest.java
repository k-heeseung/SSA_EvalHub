package com.example.evalhub.dto;

public record ChangePasswordRequest(
        String currentPassword,
        String newPassword
) {
}
