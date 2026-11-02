package com.tinyclass.storage;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class FileDtos {
    private FileDtos() {}
    public record FileView(UUID id, UUID storageConnectionId, String provider, String purpose, String originalName,
            String mimeType, long sizeBytes, String status, boolean learnerDownloadAllowed, Long version, Instant createdAt) {
        public static FileView from(StoredFile f, String provider) {
            return new FileView(f.getId(),f.getStorageConnectionId(),provider,f.getPurpose(),f.getOriginalName(),f.getMimeType(),
                    f.getSizeBytes(),f.getStatus(),f.isLearnerDownloadAllowed(),f.getVersion(),f.getCreatedAt());
        }
    }
    public record ConnectionView(UUID id, String provider, String displayName, String status, boolean isDefault, long usedBytes, long quotaBytes) {}
    public record PolicyInput(@NotNull Long version,@NotNull Boolean learnerDownloadAllowed) {}
}
