package com.tinyclass.classes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;
import java.util.UUID;

public interface StudentRepository extends JpaRepository<Student, UUID>, JpaSpecificationExecutor<Student> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Student s where s.id = :id and s.teacherId = :teacherId")
    Optional<Student> lockOwned(UUID id, UUID teacherId);
    Optional<Student> findByIdAndTeacherId(UUID id, UUID teacherId);
}
