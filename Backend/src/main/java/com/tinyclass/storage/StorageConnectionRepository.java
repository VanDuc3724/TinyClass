package com.tinyclass.storage;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface StorageConnectionRepository extends JpaRepository<StorageConnection, UUID> {
    List<StorageConnection> findByTeacherId(UUID teacher);
    Optional<StorageConnection> findByTeacherIdAndProvider(UUID teacher, String provider);
    Optional<StorageConnection> findByIdAndTeacherId(UUID id, UUID teacher);
}
