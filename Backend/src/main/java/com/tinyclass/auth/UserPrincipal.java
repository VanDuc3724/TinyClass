package com.tinyclass.auth;

import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.time.Instant;

public final class UserPrincipal implements UserDetails, CredentialsContainer {
    private final UUID id;
    private final String email;
    private final String role;
    private final boolean enabled;
    private final Instant passwordChangedAt;
    private final long credentialVersion;
    private String password;

    public UserPrincipal(UserAccount user) {
        id = user.getId();
        email = user.getEmail();
        role = user.getRole();
        enabled = "ACTIVE".equals(user.getStatus());
        password = user.getPasswordHash();
        passwordChangedAt = user.getPasswordChangedAt();
        credentialVersion = user.getCredentialVersion();
    }

    public UUID id() { return id; }
    public String role() { return role; }
    public Instant passwordChangedAt() { return passwordChangedAt; }
    public long credentialVersion() { return credentialVersion; }
    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return password; }
    @Override public boolean isEnabled() { return enabled; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }
    @Override public void eraseCredentials() { password = null; }
}
