package com.example.evalhub;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import javax.sql.DataSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class CriterionMaxScoreMigrationTests {
    @Autowired DataSource dataSource;
    @Test void legacyWeightsScoresAndTotalsArePreservedAndLargerMaxIsAllowed() throws Exception {
        String schema="criterion_migration_"+UUID.randomUUID().toString().replace("-","");
        try(var connection=dataSource.getConnection();var sql=connection.createStatement()) {
            sql.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("20").load().migrate();
                sql.execute("insert into "+schema+".programs(id,title,type,status) values (1,'legacy','MODULE_A','ACTIVE')");
                sql.execute("insert into "+schema+".users(id,email,password,role) values (1,'migration@example.com','encoded','EVALUATOR')");
                sql.execute("insert into "+schema+".teams(id,program_id,name,display_name) values (1,1,'legacy','legacy')");
                sql.execute("insert into "+schema+".evaluation_criteria(id,program_id,name,max_score,weight,display_order) values (1,1,'legacy',10,3.5,1)");
                sql.execute("insert into "+schema+".evaluation_assignments(id,program_id,evaluator_id,status) values (1,1,1,'SUBMITTED')");
                sql.execute("insert into "+schema+".evaluation_submissions(id,assignment_id,team_id,status,total_score) values (1,1,1,'SUBMITTED',8)");
                sql.execute("insert into "+schema+".evaluation_scores(submission_id,criterion_id,score) values (1,1,8)");
                Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
                try(var rows=sql.executeQuery("select c.max_score,c.weight,s.score,e.total_score from "+schema+".evaluation_criteria c join "+schema+".evaluation_scores s on s.criterion_id=c.id join "+schema+".evaluation_submissions e on e.id=s.submission_id")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getBigDecimal("max_score")).isEqualByComparingTo("10");
                    assertThat(rows.getBigDecimal("weight")).isEqualByComparingTo("3.5");
                    assertThat(rows.getBigDecimal("score")).isEqualByComparingTo("8");
                    assertThat(rows.getBigDecimal("total_score")).isEqualByComparingTo("8");
                }
                sql.execute("update "+schema+".evaluation_criteria set max_score=40.25 where id=1");
                sql.execute("update "+schema+".evaluation_scores set score=40.25 where criterion_id=1");
                assertThatThrownBy(()->sql.execute("update "+schema+".evaluation_criteria set max_score=0 where id=1")).isInstanceOf(java.sql.SQLException.class);
            } finally { sql.execute("drop schema "+schema+" cascade"); }
        }
    }
}
