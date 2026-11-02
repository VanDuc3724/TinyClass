package com.tinyclass.family;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface GuardianInvitationRepository extends JpaRepository<GuardianInvitation, UUID> {
    Optional<GuardianInvitation> findByTokenHash(String hash);
    Page<GuardianInvitation> findByStudentId(UUID studentId, Pageable pageable);
    List<GuardianInvitation> findByStudentIdAndInvitedEmailAndStatus(UUID studentId, String email, String status);
}
