package com.example.evalhub.repository;

import com.example.evalhub.entity.ParticipantAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParticipantAttachmentRepository extends JpaRepository<ParticipantAttachment, Long> {

    List<ParticipantAttachment> findByParticipantIdOrderByUploadedAtDesc(Long participantId);
}
