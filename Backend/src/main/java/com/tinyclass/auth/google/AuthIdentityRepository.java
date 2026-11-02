package com.tinyclass.auth.google;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AuthIdentityRepository extends JpaRepository<AuthIdentity, UUID> {
    Optional<AuthIdentity> findByIssuerAndProviderSubjectAndUnlinkedAtIsNull(String issuer, String subject);
    Optional<AuthIdentity> findByUserIdAndUnlinkedAtIsNull(UUID userId);
    Optional<AuthIdentity> findByIdAndUserIdAndUnlinkedAtIsNull(UUID id, UUID userId);
}
