package com.example.evalhub;

import com.example.evalhub.controller.EvaluationResultExportController;
import com.example.evalhub.service.EvaluationResultsPdfService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.nio.charset.StandardCharsets;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(EvaluationResultExportControllerTest.Config.class)
@WebAppConfiguration
class EvaluationResultExportControllerTest {
    @Configuration @EnableWebMvc @EnableWebSecurity @EnableMethodSecurity
    static class Config {
        @Bean EvaluationResultsPdfService service() { return mock(EvaluationResultsPdfService.class); }
        @Bean EvaluationResultExportController controller(EvaluationResultsPdfService service) {
            return new EvaluationResultExportController(service);
        }
        @Bean SecurityFilterChain chain(HttpSecurity http) throws Exception {
            return http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                    .exceptionHandling(error -> error.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                    .build();
        }
    }
    @Autowired WebApplicationContext context;
    @Autowired EvaluationResultsPdfService service;
    MockMvc mvc;

    @BeforeEach void setup() {
        reset(service);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(service.export(1L, true)).thenReturn(new EvaluationResultsPdfService.PdfFile("한글_최종합격.pdf",
                "%PDF-1.4\ntest".getBytes(StandardCharsets.US_ASCII)));
    }

    @ParameterizedTest @ValueSource(strings = {"MANAGER", "SUPER_ADMIN"})
    void managersDownloadAttachmentWithKoreanFilename(String role) throws Exception {
        mvc.perform(get("/api/programs/1/evaluation-results/pdf").param("onlyPassed", "true").with(user("manager").roles(role)))
                .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", containsString("attachment;")))
                .andExpect(header().string("Content-Disposition", containsString("filename*=UTF-8''")))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes("%PDF-1.4\ntest".getBytes(StandardCharsets.US_ASCII)));
        verify(service).export(1L, true);
    }

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "EVALUATOR"})
    void otherRolesCannotExport(String role) throws Exception {
        mvc.perform(get("/api/programs/1/evaluation-results/pdf").with(user("other").roles(role))).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void anonymousCannotExport() throws Exception {
        mvc.perform(get("/api/programs/1/evaluation-results/pdf")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void defaultRequestDownloadsDetails() throws Exception {
        when(service.export(1L, false)).thenReturn(new EvaluationResultsPdfService.PdfFile("상세평가.pdf", new byte[]{1, 2}));
        mvc.perform(get("/api/programs/1/evaluation-results/pdf").with(user("manager").roles("MANAGER")))
                .andExpect(status().isOk());
        verify(service).export(1L, false);
    }
}
