package com.tinyclass.classes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;
import java.util.UUID;

public interface LearningClassRepository extends JpaRepository<LearningClass, UUID>, JpaSpecificationExecutor<LearningClass> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from LearningClass c where c.id = :id and c.teacherId = :teacherId")
    Optional<LearningClass> lockOwned(UUID id, UUID teacherId);
    Optional<LearningClass> findByIdAndTeacherId(UUID id, UUID teacherId);
}
