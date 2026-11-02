package com.tinyclass.support;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;

@TestConfiguration(proxyBeanMethods = false)
public class MockOidcConfiguration {
    @Bean(destroyMethod = "close")
    MockOidcProvider mockOidcProvider(@Value("${tinyclass.google.test.port:0}") int port,
            @Value("${tinyclass.google.test.interactive:false}") boolean interactive) throws Exception {
        return new MockOidcProvider(port, interactive);
    }
    @Bean
    ClientRegistrationRepository mockGoogleRegistration(MockOidcProvider provider, Environment environment) {
        return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google-login")
                .clientId("tinyclass-test-client").clientSecret("synthetic-test-client-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).scope("openid", "email", "profile")
                .authorizationUri(provider.issuer() + "/authorize").tokenUri(provider.issuer() + "/token")
                .jwkSetUri(provider.issuer() + "/jwks").issuerUri(provider.issuer()).userNameAttributeName("sub")
                .redirectUri(environment.getProperty("tinyclass.google.test.redirect-uri", "{baseUrl}/api/v1/auth/google/callback"))
                .clientName("Google (local OIDC test)").build());
    }
}
