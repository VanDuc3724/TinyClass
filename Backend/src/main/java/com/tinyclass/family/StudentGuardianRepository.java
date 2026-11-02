package com.tinyclass.family;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface StudentGuardianRepository extends JpaRepository<StudentGuardian, UUID> {
    Optional<StudentGuardian> findByStudentIdAndGuardianUserId(UUID studentId, UUID userId);
    boolean existsByStudentIdAndGuardianUserIdAndStatus(UUID studentId, UUID userId, String status);
    Page<StudentGuardian> findByStudentId(UUID studentId, Pageable pageable);
    Page<StudentGuardian> findByGuardianUserIdAndStatus(UUID userId, String status, Pageable pageable);
}
