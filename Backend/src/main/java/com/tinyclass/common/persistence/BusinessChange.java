package com.tinyclass.common.persistence;

import java.util.UUID;

/** Contains source identifiers only. Notification delivery stays in the source transaction. */
public record BusinessChange(UUID actor, String action, String entityType, UUID entityId) {}
