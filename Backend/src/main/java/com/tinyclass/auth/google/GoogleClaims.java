package com.tinyclass.auth.google;

import com.tinyclass.common.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import java.util.Locale;

/** Called only after Spring validates the ID token signature, issuer, audience, time and nonce. */
public record GoogleClaims(String issuer, String subject, String email, boolean emailVerified, String hostedDomain, String displayName) {
    public static GoogleClaims from(OidcUser principal) {
        var token = principal.getIdToken();
        String email = token.getEmail();
        if (email == null || email.isBlank() || email.length() > 254 || token.getSubject() == null || token.getSubject().isBlank() || token.getSubject().length() > 255)
            throw new ApiException(HttpStatus.BAD_REQUEST, "GOOGLE_PROFILE_INVALID", "Google chưa cung cấp thông tin tài khoản hợp lệ.");
        return new GoogleClaims(token.getIssuer().toString().replaceAll("/+$", ""), token.getSubject(),
                email.strip().toLowerCase(Locale.ROOT), Boolean.TRUE.equals(token.getEmailVerified()),
                token.getClaimAsString("hd"), token.getFullName());
    }
    public boolean authoritativeEmail() { return emailVerified && (email.endsWith("@gmail.com") || (hostedDomain != null && !hostedDomain.isBlank())); }
}
