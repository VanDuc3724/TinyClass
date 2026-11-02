package com.tinyclass.auth.google;

import com.tinyclass.auth.UserPrincipal;
import jakarta.servlet.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

public class GoogleFlowRequests implements OAuth2AuthorizationRequestResolver, AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
    public static final String PENDING = GoogleFlowRequests.class.getName() + ".pending";
    public static final String FLOW = GoogleFlowRequests.class.getName() + ".flow";
    public static final String PRIOR = GoogleFlowRequests.class.getName() + ".prior";
    private final DefaultOAuth2AuthorizationRequestResolver resolver;
    private final HttpSessionOAuth2AuthorizationRequestRepository repository = new HttpSessionOAuth2AuthorizationRequestRepository();
    public GoogleFlowRequests(ClientRegistrationRepository registrations) {
        resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/api/v1/auth/google/authorize");
        resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
    }
    @Override public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return "/api/v1/auth/google/authorize".equals(request.getServletPath()) ? resolve(request, "google-login") : null;
    }
    @Override public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
        var session = request.getSession(false);
        var flow = session == null ? null : (GoogleFlow) session.getAttribute(PENDING);
        if (flow == null || !flow.fresh() || !"google-login".equals(registrationId)) return null;
        session.removeAttribute(PENDING);
        var resolved = resolver.resolve(request, "google-login");
        return OAuth2AuthorizationRequest.from(resolved).attributes(attributes -> attributes.put(FLOW, flow))
                .additionalParameters(parameters -> parameters.put("prompt", "select_account")).build();
    }
    @Override public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) { return repository.loadAuthorizationRequest(request); }
    @Override public void saveAuthorizationRequest(OAuth2AuthorizationRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        repository.saveAuthorizationRequest(request, servletRequest, response);
    }
    @Override public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal) request.setAttribute(PRIOR, auth);
        var saved = repository.removeAuthorizationRequest(request, response);
        if (saved != null) request.setAttribute(FLOW, saved.getAttribute(FLOW));
        return saved;
    }
}
