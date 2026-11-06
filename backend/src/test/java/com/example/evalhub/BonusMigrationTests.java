package com.example.evalhub;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import javax.sql.DataSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class BonusMigrationTests {
    @Autowired DataSource dataSource;
    @Test void legacyScoresZeroMissingUnboundedAndReasonsArePreserved() throws Exception {
        String schema="bonus_migration_"+UUID.randomUUID().toString().replace("-","");
        try(var connection=dataSource.getConnection();var sql=connection.createStatement()) {
            sql.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("19").load().migrate();
                sql.execute("insert into "+schema+".programs(id,title,type,status,bonus_enabled,max_bonus) values (1,'bounded','MODULE_A','ACTIVE',true,5),(2,'unbounded','MODULE_A','ACTIVE',true,null),(3,'disabled','MODULE_A','DRAFT',false,null)");
                sql.execute("insert into "+schema+".teams(id,program_id,name,display_name,bonus_score,bonus_reason) values (1,1,'scored','scored',3,'old reason'),(2,1,'zero','zero',0,null),(3,1,'missing','missing',null,null),(4,2,'unbounded','unbounded',7,null)");
                sql.execute("insert into "+schema+".users(id,email,password,role) values (1,'migration@example.com','encoded','EVALUATOR')");
                sql.execute("insert into "+schema+".evaluation_assignments(id,program_id,evaluator_id,status) values (1,1,1,'IN_PROGRESS')");
                sql.execute("insert into "+schema+".evaluation_submissions(assignment_id,team_id,status,total_score) values (1,1,'DRAFT',0)");
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
                try(var rows=sql.executeQuery("select t.id,t.bonus_reason,s.score,b.name,b.max_score from "+schema+".teams t join "+schema+".bonus_items b on b.program_id=t.program_id left join "+schema+".team_bonus_scores s on s.team_id=t.id and s.bonus_item_id=b.id order by t.id")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBigDecimal("score")).isEqualByComparingTo("3");
                    assertThat(rows.getString("bonus_reason")).isEqualTo("old reason");
                    assertThat(rows.getString("name")).isEqualTo("가산점");
                    assertThat(rows.getBigDecimal("max_score")).isEqualByComparingTo("5");
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBigDecimal("score")).isEqualByComparingTo("0");
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBigDecimal("score")).isNull();
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBigDecimal("score")).isEqualByComparingTo("7");
                    assertThat(rows.getBigDecimal("max_score")).isNull();
                    assertThat(rows.next()).isFalse();
                }
                try(var rows=sql.executeQuery("select evaluation_started from "+schema+".programs order by id")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBoolean(1)).isTrue();
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBoolean(1)).isFalse();
                    assertThat(rows.next()).isTrue(); assertThat(rows.getBoolean(1)).isFalse();
                }
            } finally { sql.execute("drop schema "+schema+" cascade"); }
        }
    }
}
