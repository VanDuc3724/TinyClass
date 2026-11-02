package com.tinyclass.classes;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {
    boolean existsByClassIdAndStudentId(UUID classId, UUID studentId);
    long countByClassIdAndStatus(UUID classId, String status);
    long countByStudentIdAndStatus(UUID studentId, String status);
    Page<Enrollment> findByClassId(UUID classId, Pageable pageable);
    List<Enrollment> findByClassIdAndStatus(UUID classId, String status);
    List<Enrollment> findByStudentId(UUID studentId);
}
