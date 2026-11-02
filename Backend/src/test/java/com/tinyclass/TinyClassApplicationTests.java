package com.tinyclass;

import com.tinyclass.common.audit.AuditEvent;
import com.tinyclass.common.audit.AuditEventRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TinyClassApplicationTests {
    @Autowired
    Environment environment;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    AuditEventRepository events;

    @Autowired
    JsonMapper mapper;

    @PersistenceContext
    EntityManager entityManager;

    @Test
    void flywayMigratesTheDedicatedPostgresTestDatabase() {
        assertThat(jdbc.queryForObject("SELECT current_database()", String.class))
                .isEqualTo("tinyclass_test");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success",
                Integer.class)).isEqualTo(1);
    }

    @Test
    @Transactional
    void auditEventsRoundTripAsPostgresJsonWithoutChangingTheStoredSnapshot() {
        var event = new AuditEvent(null, "CLASS_CREATED", "CLASS", UUID.randomUUID(),
                Map.of("capacity", 10, "name", "Test class"), null, "audit-test");
        events.save(event);
        entityManager.flush();
        entityManager.clear();

        var restored = events.findById(event.getId()).orElseThrow();
        assertThat(restored.getChangedFields()).containsEntry("capacity", 10);
        assertThat(restored.getCreatedAt()).isNotNull();
        assertThat(jdbc.queryForObject(
                "SELECT changed_fields ->> 'capacity' FROM audit_events WHERE id = ?",
                String.class, event.getId())).isEqualTo("10");
    }

    @Test
    void healthChecksDatabaseAndPreservesAValidRequestId() throws Exception {
        var response = send("GET", "/api/v1/health", "foundation-health");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("X-Request-ID")).contains("foundation-health");
        assertThat(mapper.readTree(response.body()).path("data").path("status").stringValue())
                .isEqualTo("UP");
        assertThat(response.body()).doesNotContain("jdbc:", "password", "PostgreSQL");
    }

    @Test
    void privateRequestsReturnJsonWithoutCreatingDefaultLoginCredentials() throws Exception {
        var response = send("GET", "/api/v1/classes", "private-request");
        var body = mapper.readTree(response.body());
        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(body.path("code").stringValue()).isEqualTo("UNAUTHENTICATED");
        assertThat(body.path("traceId").stringValue()).isEqualTo("private-request");
        assertThat(response.headers().firstValue("Location")).isEmpty();
    }

    @Test
    void writesWithoutCsrfAreRejectedUsingTheSameErrorContract() throws Exception {
        var response = send("POST", "/api/v1/classes", "csrf-request");
        var body = mapper.readTree(response.body());
        assertThat(response.statusCode()).isEqualTo(403);
        assertThat(body.path("code").stringValue()).isEqualTo("ACCESS_DENIED");
        assertThat(body.path("traceId").stringValue()).isEqualTo("csrf-request");
    }

    @Test
    void invalidRequestIdsAreReplacedBeforeTheyReachLogsAndResponses() throws Exception {
        var response = send("GET", "/api/v1/health", "x".repeat(101));
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("X-Request-ID").orElseThrow())
                .matches("[0-9a-f-]{36}");
    }

    private HttpResponse<String> send(String method, String path, String requestId) throws Exception {
        int port = environment.getRequiredProperty("local.server.port", Integer.class);
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header("X-Request-ID", requestId)
                .method(method, HttpRequest.BodyPublishers.noBody())
                .build();
        try (var client = HttpClient.newHttpClient()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString());
        }
    }
}
