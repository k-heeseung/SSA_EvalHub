package com.example.evalhub;

import com.example.evalhub.dto.SaveApplicationRequest;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.service.ApplicationService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class RequiredCheckboxIntegrationTests {
    @Autowired ApplicationService service;
    @Autowired ApplicationRepository applications;
    @Autowired ApplicationAnswerRepository answers;
    @Autowired ApplicationFormFieldRepository fields;
    @Autowired ProgramRepository programs;
    @Autowired UserRepository users;
    @Autowired TeamRepository teams;
    @Autowired EntityManager entityManager;
    private Application application;
    private Program program;
    private Long memberId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();
        User manager = users.save(new User("manager-" + suffix + "@example.com", "encoded", Role.MANAGER));
        User member = users.save(new User("member-" + suffix + "@example.com", "encoded", Role.MEMBER));
        memberId = member.getId();
        program = programs.save(new Program(manager, "checkbox-test", null, ProgramType.MODULE_A,
                LocalDate.now().minusDays(1), LocalDate.now().plusDays(2),
                LocalDate.now().plusDays(3), LocalDate.now().plusDays(4), null));
        program.updateParticipantType(ParticipantType.INDIVIDUAL);
        Team team = teams.save(new Team(program, "applicant", ParticipantType.INDIVIDUAL, null, "applicant", null, null));
        application = applications.save(new Application(program, member, team));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "[]", "[\"\"]", "[\"   \"]", "[null]", "[1, true, {}]",
            "not-json", "{}", "null", "\"창업\"", "[\"창업\"] trailing"})
    void requiredCheckboxRejectsEmptyAndMalformedSelections(String value) {
        var field = field("CHECKBOX", true);
        assertThatThrownBy(() -> service.submit(application.getId(), memberId, request(field, value)))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(error.getReason()).contains("하나 이상 선택", "관심 분야");
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"[\"창업\"]", "[\"창업\",\"기술\"]"})
    void requiredCheckboxAcceptsActualSelections(String value) {
        var field = field("CHECKBOX", true);
        assertThat(service.submit(application.getId(), memberId, request(field, value)).status())
                .isEqualTo(ApplicationStatus.SUBMITTED);
    }

    @Test
    void optionalCheckboxAllowsNoSelection() {
        var field = field("CHECKBOX", false);
        assertThat(service.submit(application.getId(), memberId, request(field, "[]")).status())
                .isEqualTo(ApplicationStatus.SUBMITTED);
    }

    @Test
    void draftAllowsEmptyRequiredCheckbox() {
        var field = field("CHECKBOX", true);
        assertThat(service.saveDraft(application.getId(), memberId, request(field, "[]")).status())
                .isEqualTo(ApplicationStatus.DRAFT);
    }

    @Test
    void failedResubmissionKeepsAnswerAndDraftStatusAfterReload() {
        var field = field("CHECKBOX", true);
        application.submit();
        assertThatThrownBy(() -> service.submit(application.getId(), memberId, request(field, "[]")))
                .isInstanceOf(ResponseStatusException.class);
        Long applicationId = application.getId();
        entityManager.flush();
        entityManager.clear();
        assertThat(applications.findById(applicationId).orElseThrow().getStatus()).isEqualTo(ApplicationStatus.DRAFT);
        assertThat(answers.findByApplicationId(applicationId)).singleElement()
                .satisfies(answer -> assertThat(answer.getValue()).isEqualTo("[]"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEXT", "SHORT_TEXT", "LONG_TEXT", "RADIO"})
    void otherRequiredFieldsStillRejectBlankAnswers(String type) {
        var field = field(type, true);
        assertThatThrownBy(() -> service.submit(application.getId(), memberId, request(field, " ")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void requiredFileStillNeedsAttachment() {
        var field = field("FILE", true);
        assertThatThrownBy(() -> service.submit(application.getId(), memberId, request(field, "")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getReason()).contains("필수 첨부파일"));
    }

    @Test
    void legacyCheckboxTypeUsesSameValidation() {
        var field = field("체크박스", true);
        assertThatThrownBy(() -> service.submit(application.getId(), memberId, request(field, "[]")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"SHORT_TEXT", "LONG_TEXT"})
    void textTypesAndAnswersSurviveSavingAndReloading(String type) {
        var field = field(type, true);
        String value = type.equals("LONG_TEXT") ? "첫 번째 문단\n두 번째 문단" : "단답형 답변";
        Long applicationId = application.getId();
        assertThat(service.saveDraft(applicationId, memberId, request(field, value)).status())
                .isEqualTo(ApplicationStatus.DRAFT);
        entityManager.flush();
        entityManager.clear();
        assertThat(fields.findById(field.getId()).orElseThrow().getFieldType()).isEqualTo(type);
        assertThat(answers.findByApplicationId(applicationId)).singleElement()
                .satisfies(answer -> assertThat(answer.getValue()).isEqualTo(value));
        assertThat(service.submit(applicationId, memberId, request(field, value)).status())
                .isEqualTo(ApplicationStatus.SUBMITTED);
    }

    private ApplicationFormField field(String type, boolean required) {
        return fields.save(new ApplicationFormField(program, "관심 분야", type, required, 1, "창업\n기술"));
    }

    private SaveApplicationRequest request(ApplicationFormField field, String value) {
        return new SaveApplicationRequest(null, "지원자", null, null, List.of(),
                List.of(new SaveApplicationRequest.AnswerInput(field.getId(), value)));
    }
}
