package com.tinyclass.auth.google;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.ApiException;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.*;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;
import java.io.*;
import java.time.Instant;

@Component
public class GoogleLoginHandlers implements AuthenticationSuccessHandler, AuthenticationFailureHandler {
    private static final String RESULT = GoogleLoginHandlers.class.getName() + ".result";
    private final GoogleAccountService accounts;
    private final RecentAuthentication recent;
    private final SecurityContextRepository contexts;
    private final AccountMailer urls;
    public GoogleLoginHandlers(GoogleAccountService accounts, RecentAuthentication recent, SecurityContextRepository contexts, AccountMailer urls) {
        this.accounts = accounts; this.recent = recent; this.contexts = contexts; this.urls = urls;
    }
    public record Result(String status, String code, String nextPath, Instant createdAt) implements Serializable {}
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        var flow = (GoogleFlow) request.getAttribute(GoogleFlowRequests.FLOW);
        var previous = prior(request);
        try {
            var mapped = accounts.resolve(GoogleClaims.from((OidcUser) authentication.getPrincipal()), flow,
                    previous == null ? null : (UserPrincipal) previous.getPrincipal(), (String) request.getAttribute(RequestIdFilter.ATTRIBUTE));
            var principal = new UserPrincipal(mapped.user()); principal.eraseCredentials();
            save(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()), request, response);
            if (flow.intent() == GoogleFlow.Intent.REAUTHENTICATE) recent.remember(request.getSession(), mapped.user());
            finish(request, response, new Result("SUCCESS", flow.intent().name(), mapped.nextPath(), Instant.now()));
        } catch (ApiException failure) { fail(request, response, flow, failure.code()); }
        catch (DataIntegrityViolationException failure) { fail(request, response, flow, "GOOGLE_IDENTITY_ALREADY_LINKED"); }
        catch (RuntimeException failure) { fail(request, response, flow, "GOOGLE_AUTHENTICATION_FAILED"); }
    }
    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception) throws IOException {
        // Provider messages can contain untrusted text or tokens. Expose only a fixed application code.
        String code = exception instanceof org.springframework.security.oauth2.core.OAuth2AuthenticationException oauth
                && "access_denied".equals(oauth.getError().getErrorCode()) ? "GOOGLE_LOGIN_CANCELLED" : "GOOGLE_AUTHENTICATION_FAILED";
        fail(request, response, (GoogleFlow) request.getAttribute(GoogleFlowRequests.FLOW), code);
    }
    private void fail(HttpServletRequest request, HttpServletResponse response, GoogleFlow flow, String code) throws IOException {
        var previous = prior(request);
        boolean restore = previous != null && accounts.stillCurrent((UserPrincipal) previous.getPrincipal());
        save(restore ? previous : null, request, response);
        String next = restore ? ("TEACHER".equals(((UserPrincipal) previous.getPrincipal()).role()) ? "/teacher/account" : "/family/account") : "/login";
        if (!restore && flow != null && flow.invitationToken() != null) next = "/invite#token=" + flow.invitationToken();
        finish(request, response, new Result("ERROR", code, next, Instant.now()));
    }
    private Authentication prior(HttpServletRequest request) {
        var stored = (Authentication) request.getAttribute(GoogleFlowRequests.PRIOR);
        if (stored != null && stored.getPrincipal() instanceof UserPrincipal) return stored;
        var current = SecurityContextHolder.getContext().getAuthentication();
        return current != null && current.getPrincipal() instanceof UserPrincipal ? current : null;
    }
    private void save(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        var context = SecurityContextHolder.createEmptyContext(); context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context); contexts.saveContext(context, request, response);
    }
    private void finish(HttpServletRequest request, HttpServletResponse response, Result result) throws IOException {
        request.getSession().removeAttribute(GoogleFlowRequests.PENDING);
        request.getSession().setAttribute(RESULT, result);
        response.sendRedirect(urls.link("/auth/google/result", "").replaceFirst("#$", ""));
    }
    public Result result(HttpSession session) {
        var result = session == null ? null : (Result) session.getAttribute(RESULT);
        return result != null && result.createdAt().isAfter(Instant.now().minusSeconds(600))
                ? result : new Result("ERROR", "GOOGLE_RESULT_EXPIRED", "/login", Instant.now());
    }
    public void clear(HttpSession session) { if (session != null) session.removeAttribute(RESULT); }
}
