package com.tinyclass.common.audit;
import com.tinyclass.common.persistence.Timestamps;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    private UUID id;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "changed_fields", columnDefinition = "jsonb")
    private Map<String, Object> changedFields;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "request_id", length = 100)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuditEvent() {
    }

    public AuditEvent(UUID actorId, String action, String entityType, UUID entityId,
                      Map<String, Object> changedFields, String reason, String requestId) {
        this.id = UUID.randomUUID();
        this.actorId = actorId;
        this.action = Objects.requireNonNull(action);
        this.entityType = Objects.requireNonNull(entityType);
        this.entityId = entityId;
        this.changedFields = changedFields == null ? null
                : Collections.unmodifiableMap(new LinkedHashMap<>(changedFields));
        this.reason = reason;
        this.requestId = requestId;
        this.createdAt = Timestamps.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public Map<String, Object> getChangedFields() {
        return changedFields;
    }

    public String getReason() {
        return reason;
    }

    public String getRequestId() {
        return requestId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
