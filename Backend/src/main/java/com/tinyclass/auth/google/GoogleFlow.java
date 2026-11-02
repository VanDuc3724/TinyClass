package com.tinyclass.auth.google;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record GoogleFlow(Intent intent, UUID actorId, long credentialVersion, String invitationToken,
                         String displayName, RecentAuthentication.Proof proof, Instant createdAt) implements Serializable {
    public enum Intent { LOGIN, REGISTER, LINK, REAUTHENTICATE }
    public boolean fresh() { return createdAt.isAfter(Instant.now().minusSeconds(300)) && !createdAt.isAfter(Instant.now()); }
}
