package com.example.evalhub;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class ProgramScheduleMigrationTests {
    @Autowired DataSource dataSource;

    @Test
    void oldDatesMigrateToSeoulStartAndExclusiveNextDayWithoutChangingDates() throws Exception {
        String schema = "schedule_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("18").load().migrate();
                statement.execute("insert into " + schema + ".programs(title,type,status,application_start,application_deadline,evaluation_start,evaluation_deadline) "
                        + "values ('old','MODULE_A','RECRUITING','2030-11-10','2030-11-20','2030-11-21','2030-11-30'),"
                        + "('empty','MODULE_A','DRAFT',null,null,null,null)");
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
                try (var rows = statement.executeQuery("select * from " + schema + ".programs order by id")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getObject("application_start_at", OffsetDateTime.class).toInstant().toString()).isEqualTo("2030-11-09T15:00:00Z");
                    assertThat(rows.getObject("application_deadline_at", OffsetDateTime.class).toInstant().toString()).isEqualTo("2030-11-20T15:00:00Z");
                    assertThat(rows.getObject("evaluation_start_at", OffsetDateTime.class).toInstant().toString()).isEqualTo("2030-11-20T15:00:00Z");
                    assertThat(rows.getObject("evaluation_deadline_at", OffsetDateTime.class).toInstant().toString()).isEqualTo("2030-11-30T15:00:00Z");
                    assertThat(rows.getString("application_deadline")).isEqualTo("2030-11-20");
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getObject("application_start_at")).isNull();
                    assertThat(rows.getObject("application_deadline_at")).isNull();
                }
            } finally {
                // Only the unique schema created by this test is removed.
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }
}
