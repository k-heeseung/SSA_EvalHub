package com.example.evalhub;

import com.example.evalhub.entity.*;
import com.example.evalhub.repository.ProgramRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@WithMockUser(roles = "MANAGER")
class ProgramPublicationIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ProgramRepository programs;

    private Program draft(long applicationStart, long applicationEnd, long evaluationStart, long evaluationEnd) {
        Program program = new Program(null, "publication-test", null, ProgramType.MODULE_A,
                null, null, null, null, null);
        Instant now = Instant.now();
        program.updateSchedule(now.plusSeconds(applicationStart), now.plusSeconds(applicationEnd),
                now.plusSeconds(evaluationStart), now.plusSeconds(evaluationEnd));
        program.changeStatus(Status.DRAFT);
        return programs.saveAndFlush(program);
    }

    @ParameterizedTest
    @CsvSource({"3600,7200,10800,14400,SCHEDULED", "-3600,3600,7200,10800,RECRUITING",
            "-10800,-7200,3600,7200,PENDING_EVALUATION", "-10800,-7200,-3600,3600,ACTIVE",
            "-14400,-10800,-7200,-3600,INACTIVE"})
    void publicationCalculatesStatusFromPeriods(long start, long end, long evaluationStart, long evaluationEnd, String expected) throws Exception {
        Program program = draft(start, end, evaluationStart, evaluationEnd);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(expected));
        assertThat(programs.findById(program.getId()).orElseThrow().getStatus()).isEqualTo(Status.valueOf(expected));
    }

    @Test void incompleteDraftCannotBePublished() throws Exception {
        Program program = new Program(null, "incomplete-draft", null, ProgramType.MODULE_A,
                null, null, null, null, null);
        program.changeStatus(Status.DRAFT);
        programs.saveAndFlush(program);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isBadRequest());
        assertThat(program.getStatus()).isEqualTo(Status.DRAFT);
    }

    @Test void invalidPeriodOrderCannotBePublished() throws Exception {
        Program program = draft(7200, 3600, 10800, 14400);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isBadRequest());
        assertThat(program.getStatus()).isEqualTo(Status.DRAFT);
    }

    @Test void publishedProgramCannotBePublishedAgain() throws Exception {
        Program program = draft(3600, 7200, 10800, 14400);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isConflict());
        assertThat(program.getStatus()).isEqualTo(Status.SCHEDULED);
    }

    @Test void oldStatusEndpointIsRemoved() throws Exception {
        Program program = draft(3600, 7200, 10800, 14400);
        mvc.perform(post("/api/programs/" + program.getId() + "/status").with(csrf())
                        .contentType("application/json").content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isNotFound());
        assertThat(program.getStatus()).isEqualTo(Status.DRAFT);
    }

    @ParameterizedTest
    @EnumSource(value = Status.class, names = {"SCHEDULED", "RECRUITING", "PENDING_EVALUATION", "INACTIVE"})
    void creationRejectsArbitraryStatus(Status target) throws Exception {
        mvc.perform(post("/api/programs").with(csrf()).contentType("application/json")
                        .content("{\"title\":\"invalid-status\",\"type\":\"MODULE_A\",\"status\":\"" + target + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "EVALUATOR"})
    void otherRolesCannotPublish(String role) throws Exception {
        Program program = draft(3600, 7200, 10800, 14400);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()).with(user("other").roles(role)))
                .andExpect(status().isForbidden());
        assertThat(program.getStatus()).isEqualTo(Status.DRAFT);
    }

    @Test @WithMockUser(roles = "SUPER_ADMIN") void superAdminCanPublish() throws Exception {
        Program program = draft(3600, 7200, 10800, 14400);
        mvc.perform(post("/api/programs/" + program.getId() + "/publish").with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SCHEDULED"));
    }
}
