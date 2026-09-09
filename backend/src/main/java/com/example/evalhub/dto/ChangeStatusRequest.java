package com.example.evalhub.dto;

import com.example.evalhub.entity.Status;

public record ChangeStatusRequest(
        Status status
) {
}
