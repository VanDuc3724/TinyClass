package com.tinyclass.auth;

import com.tinyclass.common.Hashes;

import java.security.SecureRandom;
import java.util.Base64;

public final class SecretTokens {
    private static final SecureRandom RANDOM = new SecureRandom();
    private SecretTokens() {}
    public static String generate() {
        var bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    public static String hash(String value) { return Hashes.sha256Hex(value); }
}
