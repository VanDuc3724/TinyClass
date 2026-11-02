package com.tinyclass.auth;

import com.tinyclass.common.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/** Single-instance, bounded IP rate limit. Never trusts client-supplied forwarding headers. */
@Component
public class AuthAttemptLimiter {
    private final Map<String, ArrayDeque<Instant>> attempts = new HashMap<>();
    private final int limit;

    public AuthAttemptLimiter(@Value("${tinyclass.auth.attempt-limit:20}") int limit) {
        if (limit < 1) throw new IllegalArgumentException("Authentication attempt limit must be positive");
        this.limit = limit;
    }

    public synchronized void check(String address) {
        var now = Instant.now();
        var cutoff = now.minusSeconds(60);
        attempts.values().forEach(queue -> { while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) queue.removeFirst(); });
        attempts.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        if (!attempts.containsKey(address) && attempts.size() >= 1024) limited();
        var queue = attempts.computeIfAbsent(address, ignored -> new ArrayDeque<>());
        if (queue.size() >= limit) limited();
        queue.addLast(now);
    }

    private void limited() {
        throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                "Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.");
    }
}
