package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@WithMockUser(roles = "MANAGER")
class ProgramScheduleApiIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProgramRepository programs;
    @Autowired UserRepository users;
    @Autowired ApplicationService applications;
    @Autowired EntityManager entityManager;

    private static final String PRECISE = """
        {"title":"schedule-api","type":"MODULE_A","status":"ACTIVE",
         "applicationStartAt":"2030-11-10T09:00:00+09:00",
         "applicationDeadlineAt":"2030-11-20T18:00:00+09:00",
         "evaluationStartAt":"2030-11-20T18:00:00+09:00",
         "evaluationDeadlineAt":"2030-11-30T18:00:00+09:00"}
        """;

    private long create(String json) throws Exception {
        String body = mvc.perform(post("/api/programs").with(csrf()).contentType("application/json").content(json))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("id").asLong();
    }

    @Test
    void preciseTimesPersistAndAreReturnedWithExplicitOffset() throws Exception {
        long id = create(PRECISE);
        entityManager.flush();
        entityManager.clear();
        Program p = programs.findById(id).orElseThrow();
        assertThat(p.getApplicationStartAt()).isEqualTo(Instant.parse("2030-11-10T00:00:00Z"));
        assertThat(p.getApplicationDeadlineAt()).isEqualTo(Instant.parse("2030-11-20T09:00:00Z"));
        mvc.perform(get("/api/programs/open"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")].schedule.applicationStartAt").value("2030-11-10T09:00:00+09:00"))
                .andExpect(jsonPath("$[?(@.id == " + id + ")].schedule.canApply").value(false));
    }

    @Test
    void utcAndOffsetInputsRepresentTheSameInstant() throws Exception {
        long id = create(PRECISE.replace("2030-11-10T09:00:00+09:00", "2030-11-10T00:00:00Z"));
        assertThat(programs.findById(id).orElseThrow().getApplicationStartAt())
                .isEqualTo(Instant.parse("2030-11-10T00:00:00Z"));
    }

    @Test
    void offsetlessTimesAreRejected() throws Exception {
        mvc.perform(post("/api/programs").with(csrf()).contentType("application/json")
                        .content(PRECISE.replace("2030-11-10T09:00:00+09:00", "2030-11-10T09:00:00")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void equalStartAndDeadlineAreRejected() throws Exception {
        mvc.perform(post("/api/programs").with(csrf()).contentType("application/json")
                        .content(PRECISE.replace("2030-11-10T09:00:00+09:00", "2030-11-20T18:00:00+09:00")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void evaluationBeforeApplicationDeadlineIsRejected() throws Exception {
        mvc.perform(post("/api/programs").with(csrf()).contentType("application/json")
                        .content(PRECISE.replace("\"evaluationStartAt\":\"2030-11-20T18:00:00+09:00\"",
                                "\"evaluationStartAt\":\"2030-11-20T17:59:00+09:00\"")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void dateOnlyClientsKeepInclusiveDeadlineSemantics() throws Exception {
        long id = create("""
            {"title":"legacy","type":"MODULE_A","status":"ACTIVE",
             "applicationStart":"2030-11-10","applicationDeadline":"2030-11-20",
             "evaluationStart":"2030-11-21","evaluationDeadline":"2030-11-30"}
            """);
        Program p = programs.findById(id).orElseThrow();
        assertThat(p.getApplicationDeadline()).isEqualTo(LocalDate.parse("2030-11-20"));
        assertThat(p.getApplicationDeadlineAt()).isEqualTo(Instant.parse("2030-11-20T15:00:00Z"));
        assertThat(p.getEvaluationDeadlineAt()).isEqualTo(Instant.parse("2030-11-30T15:00:00Z"));
    }

    @Test
    void oldClientResendingDatesDoesNotErasePreciseTimes() throws Exception {
        long id = create(PRECISE);
        mvc.perform(patch("/api/programs/" + id).with(csrf()).contentType("application/json").content("""
            {"title":"updated","applicationStart":"2030-11-10","applicationDeadline":"2030-11-20",
             "evaluationStart":"2030-11-20","evaluationDeadline":"2030-11-30"}
            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schedule.applicationDeadlineAt").value("2030-11-20T18:00:00+09:00"));
    }

    @Test
    void partialTimePatchKeepsAllOtherInstants() throws Exception {
        long id = create(PRECISE);
        mvc.perform(patch("/api/programs/" + id).with(csrf()).contentType("application/json")
                        .content("{\"evaluationDeadlineAt\":\"2030-12-01T12:30:00+09:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schedule.applicationStartAt").value("2030-11-10T09:00:00+09:00"))
                .andExpect(jsonPath("$.schedule.evaluationDeadlineAt").value("2030-12-01T12:30:00+09:00"));
    }

    @Test
    void availabilityUsesInclusiveStartAndExclusiveEnd() {
        Program p = new Program(null, "boundary", null, ProgramType.MODULE_A, null, null, null, null, null);
        Instant start = Instant.parse("2030-11-10T00:00:00Z");
        Instant end = Instant.parse("2030-11-20T09:00:00Z");
        Instant evaluationEnd = end.plusSeconds(3600);
        p.updateSchedule(start, end, end, evaluationEnd);
        assertThat(ProgramScheduleResponse.from(p, start.minusNanos(1)).canApply()).isFalse();
        assertThat(ProgramScheduleResponse.from(p, start).canApply()).isTrue();
        assertThat(ProgramScheduleResponse.from(p, end.minusNanos(1)).canEditApplication()).isTrue();
        var boundary = ProgramScheduleResponse.from(p, end);
        assertThat(boundary.canApply()).isFalse();
        assertThat(boundary.canEditApplication()).isFalse();
        assertThat(boundary.canCancelApplication()).isFalse();
        assertThat(boundary.canEvaluate()).isTrue();
        assertThat(ProgramScheduleResponse.from(p, evaluationEnd).canEvaluate()).isFalse();
    }

    @Test
    void applicationAdmissionAndEditsUseInstantsEvenBeforeSchedulerRuns() {
        User member = users.save(new User(UUID.randomUUID() + "@example.com", "encoded", Role.MEMBER));
        Program p = new Program(null, "open", null, ProgramType.MODULE_A, null, null, null, null, null);
        Instant now = Instant.now();
        p.updateSchedule(now.minusSeconds(3600), now.plusSeconds(3600), now.plusSeconds(7200), now.plusSeconds(10800));
        p.changeStatus(Status.SCHEDULED);
        programs.save(p);
        var application = applications.startApplication(p.getId(), member.getId(), new StartApplicationRequest(null));
        assertThat(application.schedule().canEditApplication()).isTrue();
        p.updateSchedule(now.minusSeconds(3600), now.minusSeconds(1), now.plusSeconds(7200), now.plusSeconds(10800));
        assertThatThrownBy(() -> applications.saveDraft(application.applicationId(), member.getId(),
                new SaveApplicationRequest(null, "name", null, null, List.of(), List.of())))
                .isInstanceOf(ResponseStatusException.class);
    }
}
