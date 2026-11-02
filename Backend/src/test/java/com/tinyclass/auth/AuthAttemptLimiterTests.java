package com.tinyclass.auth;

import com.tinyclass.common.api.ApiException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AuthAttemptLimiterTests {
    @Test
    void limitsRepeatedAttemptsPerRemoteAddressWithoutBlockingOtherAddresses() {
        var limiter = new AuthAttemptLimiter(2);
        limiter.check("127.0.0.1"); limiter.check("127.0.0.1");
        assertThatThrownBy(() -> limiter.check("127.0.0.1")).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.status().value()).isEqualTo(429));
        assertThatCode(() -> limiter.check("127.0.0.2")).doesNotThrowAnyException();
    }
}
