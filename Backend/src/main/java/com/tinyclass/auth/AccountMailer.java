package com.tinyclass.auth;

import com.tinyclass.common.api.ApiException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import java.net.URI;

@Service
public class AccountMailer {
    private final ObjectProvider<JavaMailSender> senders;
    private final boolean enabled;
    private final String from;
    private final String baseUrl;
    public AccountMailer(ObjectProvider<JavaMailSender> senders,
            @Value("${tinyclass.mail.enabled:false}") boolean enabled,
            @Value("${tinyclass.mail.from}") String from, @Value("${tinyclass.public-url:}") String baseUrl) {
        this.senders = senders; this.enabled = enabled; this.from = from;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }
    public String link(String path, String fragment) {
        try {
            var uri = URI.create(baseUrl);
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) throw unavailable();
            return baseUrl + path + "#" + fragment;
        } catch (IllegalArgumentException exception) { throw unavailable(); }
    }
    public void send(String to, String subject, String body) {
        var sender = senders.getIfAvailable();
        if (!enabled || sender == null) throw unavailable();
        var message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(to); message.setSubject(subject); message.setText(body);
        try { sender.send(message); }
        catch (MailException exception) {
            // Do not log MailException: failed message diagnostics can contain secret links.
            throw unavailable();
        }
    }
    private ApiException unavailable() { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "MAIL_UNAVAILABLE", "Chưa thể gửi email. Vui lòng thử lại sau hoặc liên hệ người quản lý."); }
}
