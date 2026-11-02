package com.tinyclass.common.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class BaseEntity {
    @Id
    private UUID id = UUID.randomUUID();
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Timestamps.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = createdAt;
    @Version
    private Long version;

    @PreUpdate
    protected void beforeUpdate() { updatedAt = Timestamps.now(); }

    public UUID getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
