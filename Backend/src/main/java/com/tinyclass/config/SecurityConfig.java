package com.tinyclass.config;

import com.tinyclass.common.web.ApiErrorWriter;
import com.tinyclass.auth.*;
import com.tinyclass.auth.google.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.password.*;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.session.*;
import org.springframework.security.web.context.*;
import org.springframework.security.web.csrf.*;
import org.springframework.security.web.SecurityFilterChain;
import java.util.List;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ApiErrorWriter errors,
            UserAccountRepository users, SecurityContextRepository contexts,
            CsrfTokenRepository csrfTokens, SessionAuthenticationStrategy sessions,
            ObjectProvider<ClientRegistrationRepository> registrations, GoogleLoginHandlers googleHandlers) throws Exception {
        http.authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf", "/api/v1/auth/setup-status", "/api/v1/auth/providers",
                                "/api/v1/auth/google/authorize", "/api/v1/auth/google/callback", "/api/v1/auth/google/result").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/setup", "/api/v1/auth/register",
                                "/api/v1/auth/invitations/preview", "/api/v1/auth/email-verifications/confirm",
                                "/api/v1/auth/password-reset-requests", "/api/v1/auth/password-resets", "/api/v1/auth/google/start").permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/email-verifications").authenticated()
                        .requestMatchers("/api/v1/auth/methods", "/api/v1/auth/reauthenticate",
                                "/api/v1/auth/identities/*/unlink", "/api/v1/auth/password-setup-requests", "/api/v1/auth/password-setups").authenticated()
                        .requestMatchers("/api/v1/family/**", "/api/v1/guardian-invitations/accept").hasRole("PARENT")
                        .requestMatchers("/api/v1/guardian-invitations/*/revoke", "/api/v1/student-guardians/*/revoke").hasRole("TEACHER")
                        .requestMatchers("/api/v1/classes", "/api/v1/classes/**", "/api/v1/students",
                                "/api/v1/students/**", "/api/v1/enrollments/**").hasRole("TEACHER")
                        .requestMatchers("/api/v1/files", "/api/v1/files/**", "/api/v1/storage-connections", "/api/v1/storage-connections/**").hasRole("TEACHER")
                        .requestMatchers("/api/v1/topics", "/api/v1/topics/**", "/api/v1/lessons", "/api/v1/lessons/**", "/api/v1/courses", "/api/v1/courses/**").hasRole("TEACHER")
                        .requestMatchers("/api/v1/assignments", "/api/v1/assignments/**", "/api/v1/dashboard").hasRole("TEACHER")
                        .anyRequest().denyAll())
                .securityContext(context -> context.securityContextRepository(contexts))
                .sessionManagement(session -> session.sessionAuthenticationStrategy(sessions))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens))
                .requestCache(AbstractHttpConfigurer::disable)
                .addFilterBefore(new SessionAccountFilter(users, errors), AuthorizationFilter.class)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> errors.write(
                                request, response, HttpStatus.UNAUTHORIZED,
                                "UNAUTHENTICATED", "Vui lòng đăng nhập để tiếp tục."))
                        .accessDeniedHandler((request, response, exception) -> errors.write(
                                request, response, HttpStatus.FORBIDDEN,
                                "ACCESS_DENIED", "Bạn không có quyền thực hiện thao tác này.")));
        var clients = registrations.getIfAvailable();
        if (clients != null && clients.findByRegistrationId("google-login") != null) {
            var requests = new GoogleFlowRequests(clients);
            var oidc = new OidcUserService();
            oidc.setRetrieveUserInfo(request -> false);
            http.oauth2Login(oauth -> oauth.clientRegistrationRepository(clients)
                    .authorizedClientRepository(new DiscardingLoginClients())
                    .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(requests).authorizationRequestRepository(requests))
                    .redirectionEndpoint(endpoint -> endpoint.baseUri("/api/v1/auth/google/callback"))
                    .userInfoEndpoint(info -> info.oidcUserService(oidc))
                    .successHandler(googleHandlers).failureHandler(googleHandlers));
        }
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() { return new Pbkdf2PasswordEncoder("", 16, 310000,
            Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256); }

    @Bean
    AuthenticationManager authenticationManager(DatabaseUserDetailsService users, PasswordEncoder passwords) {
        var provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(passwords);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }

    @Bean
    CsrfTokenRepository csrfTokenRepository() { return new HttpSessionCsrfTokenRepository(); }

    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy(CsrfTokenRepository tokens) {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(tokens)));
    }
}
