package com.tinyclass;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class LocalProfileStartupTests {
    @Autowired
    Environment environment;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void localProfileStartsAgainstTheDevelopmentDatabase() throws Exception {
        String database = environment.getProperty("TINYCLASS_DB_NAME", "tinyclass");
        assertThat(jdbc.queryForObject("SELECT current_database()", String.class)).isEqualTo(database);
        int port = environment.getRequiredProperty("local.server.port", Integer.class);
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/health"))
                .GET().build();
        try (var client = HttpClient.newHttpClient()) {
            assertThat(client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode())
                    .isEqualTo(200);
        }
    }
}
