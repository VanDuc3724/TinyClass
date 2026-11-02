package com.tinyclass.health;

import com.tinyclass.common.api.ApiResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/v1/health")
    public ResponseEntity<ApiResponse<HealthStatus>> health() {
        try {
            if (Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class))) {
                return ResponseEntity.ok(ApiResponse.of(new HealthStatus("UP")));
            }
        } catch (DataAccessException ignored) {
            // Public health output intentionally omits connection and exception details.
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.of(new HealthStatus("DOWN")));
    }

    public record HealthStatus(String status) {
    }
}
