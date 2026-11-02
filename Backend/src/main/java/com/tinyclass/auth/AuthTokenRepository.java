package com.tinyclass.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AuthTokenRepository extends JpaRepository<AuthToken, UUID> {
    Optional<AuthToken> findByTokenHash(String tokenHash);
    List<AuthToken> findByUserIdAndPurposeAndConsumedAtIsNull(UUID userId, String purpose);
}
