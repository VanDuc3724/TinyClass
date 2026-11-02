package com.tinyclass.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;

@Component
public class EmailCooldown {
    private final Map<String, Instant> next = new HashMap<>();
    private final long seconds;
    public EmailCooldown(@Value("${tinyclass.mail.cooldown-seconds:60}") long seconds) { this.seconds = Math.max(0, seconds); }
    public synchronized boolean allow(String email) {
        var now = Instant.now();
        next.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        String key = SecretTokens.hash(email);
        if (next.containsKey(key) || next.size() >= 1024) return false;
        next.put(key, now.plusSeconds(seconds)); return true;
    }
}
