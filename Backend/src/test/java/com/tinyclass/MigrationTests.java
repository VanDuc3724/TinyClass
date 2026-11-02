package com.tinyclass;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import javax.sql.DataSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class MigrationTests {
    @Autowired DataSource source;
    @Autowired JdbcTemplate jdbc;

    @Test
    void allMigrationsRunFromAnEmptySchema() {
        String schema = newTestSchema();
        try {
            var flyway = Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isGreaterThanOrEqualTo(7);
            flyway.validate();
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema = ? and table_name in ('users', 'classes', 'students', 'class_enrollments', 'audit_events')", Integer.class, schema)).isEqualTo(5);
        } finally { dropTestSchema(schema); }
    }

    @Test
    void upgradeFromV1KeepsExistingAuditEvents() {
        String schema = newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("1").load().migrate();
            UUID id = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".audit_events(id, action, entity_type) values (?, 'FOUNDATION_CHECK', 'SYSTEM')", id);
            var flyway = Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isGreaterThanOrEqualTo(6);
            flyway.validate();
            assertThat(jdbc.queryForObject("select count(*) from " + schema + ".audit_events where id = ?", Integer.class, id)).isEqualTo(1);
        } finally { dropTestSchema(schema); }
    }

    private String newTestSchema() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("tinyclass_test");
        String schema = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("create schema " + schema);
        return schema;
    }
    private void dropTestSchema(String schema) {
        if (!schema.matches("migration_test_[a-f0-9]{32}")) throw new IllegalArgumentException("Not a temporary test schema");
        jdbc.execute("drop schema " + schema + " cascade");
    }
}
