CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    changed_fields JSONB,
    reason TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_events_entity
    ON audit_events (entity_type, entity_id, created_at);

CREATE INDEX idx_audit_events_actor
    ON audit_events (actor_id, created_at);
