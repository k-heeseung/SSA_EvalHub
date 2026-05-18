package com.example.evalhub.dto;

import com.example.evalhub.entity.ParticipantAttachment;

import java.time.LocalDateTime;

public record ParticipantAttachmentResponse(
        Long id,
        Long participantId,
        String originalFilename,
        String contentType,
        Long fileSize,
        LocalDateTime uploadedAt,
        String contentUrl
) {

    public static ParticipantAttachmentResponse from(ParticipantAttachment attachment) {
        return new ParticipantAttachmentResponse(
                attachment.getId(),
                attachment.getParticipant().getId(),
                attachment.getOriginalFilename(),
                attachment.getContentType(),
                attachment.getFileSize(),
                attachment.getUploadedAt(),
                "/api/attachments/" + attachment.getId() + "/content"
        );
    }
}
