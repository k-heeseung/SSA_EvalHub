package com.example.evalhub;

import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SessionAuthenticationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void signupStoresEncodedPassword() throws Exception {
        mockMvc.perform(post("/api/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "new-member@example.com",
                                  "password": "correct-password",
                                  "name": "New Member"
                                }
                                """))
                .andExpect(status().isOk());

        User saved = userRepository.findByEmail("new-member@example.com").orElseThrow();
        assertThat(saved.getPassword()).isNotEqualTo("correct-password");
        assertThat(passwordEncoder.matches("correct-password", saved.getPassword())).isTrue();
    }

    @Test
    void loginRequiresMatchingPasswordAndPortalRole() throws Exception {
        saveUser("member@example.com", "correct-password", Role.MEMBER);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("member@example.com", "wrong-password", "MEMBER")))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("member@example.com", "correct-password", "EVALUATOR")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void successfulLoginIssuesJwtCookieAndEnforcesRoleAuthorization() throws Exception {
        saveUser("member-session@example.com", "correct-password", Role.MEMBER);

        var loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("member-session@example.com", "correct-password", "MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andReturn();

        MockCookie jwtCookie = jwtCookie(loginResult.getResponse().getHeaders(HttpHeaders.SET_COOKIE));
        assertThat(jwtCookie.isHttpOnly()).isTrue();
        mockMvc.perform(get("/api/auth/me").cookie(jwtCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("member-session@example.com"));

        mockMvc.perform(get("/api/programs").cookie(jwtCookie))
                .andExpect(status().isForbidden());
    }

    @Test
    void stateChangingRequestRequiresCsrfAfterLogin() throws Exception {
        saveUser("csrf-member@example.com", "correct-password", Role.MEMBER);
        MockCookie jwtCookie = login("csrf-member@example.com");

        mockMvc.perform(post("/api/programs/999999999/applications")
                        .cookie(jwtCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/programs/999999999/applications")
                        .cookie(jwtCookie)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    private MockCookie login(String email) throws Exception {
        var response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "correct-password", "MEMBER")))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse();
        return jwtCookie(response.getHeaders(HttpHeaders.SET_COOKIE));
    }

    private MockCookie jwtCookie(java.util.Collection<String> setCookieHeaders) {
        String header = setCookieHeaders.stream()
                .filter(value -> value.startsWith("EVALHUB_ACCESS_TOKEN="))
                .findFirst()
                .orElseThrow();
        return MockCookie.parse(header);
    }

    private void saveUser(String email, String password, Role role) {
        userRepository.save(new User(email, passwordEncoder.encode(password), role));
    }

    private String loginJson(String email, String password, String role) {
        return """
                {
                  "email": "%s",
                  "password": "%s",
                  "role": "%s",
                  "rememberMe": false
                }
                """.formatted(email, password, role);
    }
}
