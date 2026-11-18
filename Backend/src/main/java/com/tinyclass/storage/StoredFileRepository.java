package com.tinyclass.storage;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;

public interface StoredFileRepository extends JpaRepository<StoredFile,UUID>, JpaSpecificationExecutor<StoredFile> {
    Optional<StoredFile> findByIdAndUploadedBy(UUID id, UUID actor);
    @Query("select coalesce(sum(f.sizeBytes),0) from StoredFile f where f.storageConnectionId in (select c.id from StorageConnection c where c.teacherId=:actor) and f.status in ('UPLOADING','READY')")
    long used(@Param("actor") UUID actor);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select f from StoredFile f where f.id=:id and f.uploadedBy=:actor")
    Optional<StoredFile> lockOwned(@Param("id") UUID id,@Param("actor") UUID actor);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from StoredFile f where f.storageConnectionId=:connection and f.status='UPLOADING' and f.updatedAt<:cutoff")
    List<StoredFile> lockStaleUploads(@Param("connection") UUID connection,@Param("cutoff") Instant cutoff);
    @Query(value = """
            select f.* from files f
            join storage_connections s on s.id=f.storage_connection_id
            where s.provider='LOCAL' and f.status='READY'
            and not exists (select 1 from file_chunks c where c.file_id=f.id)
            """, nativeQuery = true)
    List<StoredFile> readyWithoutContent();
    @Query(value = "select exists (select 1 from file_chunks where file_id=:id)", nativeQuery = true)
    boolean hasContent(@Param("id") UUID id);
}
