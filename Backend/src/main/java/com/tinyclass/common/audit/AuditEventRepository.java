package com.tinyclass.common.audit;

import org.springframework.data.repository.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditEventRepository extends Repository<AuditEvent, UUID> {
    Page<AuditEvent> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, UUID entityId, Pageable pageable);
    AuditEvent save(AuditEvent event);

    Optional<AuditEvent> findById(UUID id);
}
