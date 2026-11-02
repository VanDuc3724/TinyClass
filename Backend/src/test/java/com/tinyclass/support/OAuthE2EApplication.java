package com.tinyclass.support;

import com.tinyclass.TinyClassApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.util.Map;

/** Explicit test-classpath entry point; never packaged with the production application. */
public class OAuthE2EApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(TinyClassApplication.class, MockOidcConfiguration.class)
                .profiles("local", "oauth-test").properties(Map.of(
                        "tinyclass.google.test.port", "19090", "tinyclass.google.test.interactive", "true",
                        "tinyclass.google.test.redirect-uri", "http://127.0.0.1:5174/api/v1/auth/google/callback"))
                .run(args);
    }
}
