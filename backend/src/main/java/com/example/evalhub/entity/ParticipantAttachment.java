package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "participant_attachments")
@Getter
@NoArgsConstructor
public class ParticipantAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id", nullable = false)
    private ProgramParticipant participant;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false)
    private String storedFilename;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false, length = 1000)
    private String storagePath;

    @Column(nullable = false)
    private LocalDateTime uploadedAt;

    public ParticipantAttachment(
            ProgramParticipant participant,
            String originalFilename,
            String storedFilename,
            String contentType,
            Long fileSize,
            String storagePath
    ) {
        this.participant = participant;
        this.originalFilename = originalFilename;
        this.storedFilename = storedFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.storagePath = storagePath;
        this.uploadedAt = LocalDateTime.now();
    }
}
