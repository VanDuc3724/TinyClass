package com.tinyclass.storage;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface StoredFileRepository extends JpaRepository<StoredFile,UUID>, JpaSpecificationExecutor<StoredFile> {
    Optional<StoredFile> findByIdAndUploadedBy(UUID id, UUID actor);
    @Query("select coalesce(sum(f.sizeBytes),0) from StoredFile f where f.uploadedBy=:actor and f.status in ('UPLOADING','READY')")
    long used(@Param("actor") UUID actor);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select f from StoredFile f where f.id=:id and f.uploadedBy=:actor")
    Optional<StoredFile> lockOwned(@Param("id") UUID id,@Param("actor") UUID actor);
}
