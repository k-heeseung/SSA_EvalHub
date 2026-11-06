package com.example.evalhub.service;

import com.example.evalhub.entity.ParticipantAttachment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class AttachmentFiles {
    private static final Logger log = LoggerFactory.getLogger(AttachmentFiles.class);
    private final Path root;

    public AttachmentFiles(@Value("${evalhub.storage.attachments-path}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }

    public boolean isAvailable(ParticipantAttachment attachment) {
        try {
            Path path = resolve(attachment.getStoragePath());
            // Resolve symlinks too: an attachment must stay inside the storage directory.
            if (!path.toRealPath().startsWith(root.toRealPath()) || !Files.isRegularFile(path)
                    || !Files.isReadable(path) || attachment.getFileSize() == null
                    || attachment.getFileSize() <= 0 || Files.size(path) != attachment.getFileSize()) {
                return false;
            }
            try (var input = Files.newInputStream(path)) {
                return input.read() != -1;
            }
        } catch (IOException | RuntimeException error) {
            log.warn("Attachment unavailable: id={}, key={}", attachment.getId(), attachment.getStoragePath(), error);
            return false;
        }
    }

    public Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root) || path.equals(root)) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        return path;
    }
}
