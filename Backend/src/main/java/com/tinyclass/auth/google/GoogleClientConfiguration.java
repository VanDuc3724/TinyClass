package com.tinyclass.auth.google;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.*;
import java.net.URI;

@Configuration(proxyBeanMethods = false)
@Profile("!oauth-test")
@ConditionalOnProperty(name = "tinyclass.google.enabled", havingValue = "true")
public class GoogleClientConfiguration {
    @Bean
    ClientRegistrationRepository googleRegistration(@Value("${tinyclass.google.client-id:}") String id,
            @Value("${tinyclass.google.client-secret:}") String secret, @Value("${tinyclass.public-url:}") String publicUrl) {
        URI uri = URI.create(publicUrl);
        if (id.isBlank() || secret.isBlank() || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                || uri.getFragment() != null || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme())
                && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost())))))
            throw new IllegalStateException("Configure Google client credentials and a valid public HTTPS/loopback URL before enabling Google login.");
        return new InMemoryClientRegistrationRepository(CommonOAuth2Provider.GOOGLE.getBuilder("google-login")
                .clientId(id).clientSecret(secret).scope("openid", "email", "profile")
                .redirectUri(publicUrl.replaceAll("/+$", "") + "/api/v1/auth/google/callback").build());
    }
}
