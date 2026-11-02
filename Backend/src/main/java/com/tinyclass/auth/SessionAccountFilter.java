package com.tinyclass.auth;

import com.tinyclass.common.web.ApiErrorWriter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

public class SessionAccountFilter extends OncePerRequestFilter {
    private final UserAccountRepository users;
    private final ApiErrorWriter errors;
    public SessionAccountFilter(UserAccountRepository users, ApiErrorWriter errors) {
        this.users = users;
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            var account = users.findById(principal.id());
            if (account.isEmpty() || !"ACTIVE".equals(account.get().getStatus())
                    || !principal.role().equals(account.get().getRole())
                    || !java.util.Objects.equals(principal.passwordChangedAt(), account.get().getPasswordChangedAt())
                    || principal.credentialVersion() != account.get().getCredentialVersion()) {
                new SecurityContextLogoutHandler().logout(request, response, authentication);
                errors.write(request, response, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                        "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.");
                return;
            }
        } else if (authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            new SecurityContextLogoutHandler().logout(request, response, authentication);
            errors.write(request, response, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Vui lòng đăng nhập lại.");
            return;
        }
        chain.doFilter(request, response);
    }
}
