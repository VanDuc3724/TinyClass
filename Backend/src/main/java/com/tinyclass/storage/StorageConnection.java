package com.tinyclass.storage;

import com.tinyclass.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="storage_connections")
public class StorageConnection extends BaseEntity {
    @Column(name="teacher_id",nullable=false) private UUID teacherId;
    @Column(nullable=false) private String provider = "LOCAL";
    @Column(name="display_name",nullable=false) private String displayName = "Máy chủ TinyClass";
    @Column(name="root_reference",nullable=false) private String rootReference = "system-local";
    @Column(nullable=false) private String status = "CONNECTED";
    @Column(name="is_default",nullable=false) private boolean defaultStorage = true;
    @Column(name="connected_at") private Instant connectedAt = Instant.now();
    protected StorageConnection() {}
    public StorageConnection(UUID teacherId) { this.teacherId = teacherId; }
    public UUID getTeacherId() { return teacherId; }
    public String getProvider() { return provider; }
    public String getDisplayName() { return displayName; }
    public String getStatus() { return status; }
    public boolean isDefaultStorage() { return defaultStorage; }
}
