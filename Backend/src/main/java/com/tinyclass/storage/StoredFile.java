package com.tinyclass.storage;

import com.tinyclass.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="files")
public class StoredFile extends BaseEntity {
    @Column(name="uploaded_by",nullable=false) private UUID uploadedBy;
    @Column(name="storage_connection_id",nullable=false) private UUID storageConnectionId;
    @Column(nullable=false) private String purpose;
    @Column(name="learner_download_allowed",nullable=false) private boolean learnerDownloadAllowed;
    @Column(name="storage_key",nullable=false) private String storageKey;
    @Column(name="original_name",nullable=false) private String originalName;
    @Column(name="mime_type",nullable=false) private String mimeType;
    @Column(name="size_bytes",nullable=false) private long sizeBytes;
    @Column(nullable=false) private String status = "UPLOADING";
    @Column(name="checksum_sha256") private String checksum;
    @Column(name="deleted_at") private Instant deletedAt;
    protected StoredFile() {}
    public StoredFile(UUID actor, UUID connection, String purpose, boolean allowed, String key, String name, String mime, long size) {
        this.uploadedBy=actor; this.storageConnectionId=connection; this.purpose=purpose; this.learnerDownloadAllowed=allowed;
        this.storageKey=key; this.originalName=name; this.mimeType=mime; this.sizeBytes=size;
    }
    public void ready(StorageAdapter.Written written) { status="READY"; sizeBytes=written.size(); checksum=written.checksum(); }
    public void failed() { status="FAILED"; }
    public void policy(boolean allowed) { learnerDownloadAllowed=allowed; }
    public void delete() { status="DELETED"; deletedAt=Instant.now(); }
    public UUID getUploadedBy() { return uploadedBy; }
    public UUID getStorageConnectionId() { return storageConnectionId; }
    public String getPurpose() { return purpose; }
    public boolean isLearnerDownloadAllowed() { return learnerDownloadAllowed; }
    public String getStorageKey() { return storageKey; }
    public String getOriginalName() { return originalName; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getStatus() { return status; }
    public String getChecksum() { return checksum; }
}
