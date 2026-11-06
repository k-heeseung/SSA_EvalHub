package com.example.evalhub.dto;

import java.util.List;

public record AttachmentBatchResponse(List<ParticipantAttachmentResponse> uploaded, List<Failure> failed) {
    public record Failure(String name, String reason) {}
}
