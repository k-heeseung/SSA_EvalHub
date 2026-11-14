package com.example.evalhub;

import com.example.evalhub.controller.ProgramManagementController;
import com.example.evalhub.dto.CreateUserRequest;
import com.example.evalhub.service.ApplicationService;
import com.example.evalhub.service.EvaluationService;
import com.example.evalhub.service.ProgramManagementService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitConfig(UserCreationAuthorizationTest.Config.class)
@WebAppConfiguration
class UserCreationAuthorizationTest {
    @Configuration @EnableWebMvc @EnableWebSecurity @EnableMethodSecurity
    static class Config {
        @Bean jakarta.persistence.EntityManagerFactory entityManagerFactory() {
            return mock(jakarta.persistence.EntityManagerFactory.class);
        }
        @Bean ProgramManagementService service() { return mock(ProgramManagementService.class); }
        @Bean ProgramManagementController controller(ProgramManagementService service) {
            return new ProgramManagementController(service, mock(EvaluationService.class), mock(ApplicationService.class), mock(com.example.evalhub.service.AccountDeletionService.class));
        }
        @Bean SecurityFilterChain chain(HttpSecurity http) throws Exception {
            return http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                    .exceptionHandling(error -> error.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                    .build();
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired ProgramManagementService service;
    MockMvc mvc;

    @BeforeEach void setup() {
        reset(service);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @ParameterizedTest @ValueSource(strings = {"MANAGER", "EVALUATOR", "MEMBER"})
    void otherRolesCannotCreateUsers(String role) throws Exception {
        mvc.perform(post("/api/users").with(user("caller").roles(role)).with(csrf())
                        .contentType("application/json").content(payload()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void superAdminCanCreateUsers() throws Exception {
        mvc.perform(post("/api/users").with(user("admin").roles("SUPER_ADMIN")).with(csrf())
                        .contentType("application/json").content(payload()))
                .andExpect(status().isOk());
        verify(service).createUser(any(CreateUserRequest.class));
    }

    @Test void anonymousCannotCreateUsers() throws Exception {
        mvc.perform(post("/api/users").with(csrf()).contentType("application/json").content(payload()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    private String payload() {
        return "{\"email\":\"manager@example.com\",\"password\":\"test-password\",\"role\":\"MANAGER\"}";
    }
}
