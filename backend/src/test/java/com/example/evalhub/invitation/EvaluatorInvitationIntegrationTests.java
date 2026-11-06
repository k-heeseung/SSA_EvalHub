package com.example.evalhub.invitation;

import com.example.evalhub.controller.AuthController;
import com.example.evalhub.dto.ChangePasswordRequest;
import com.example.evalhub.repository.UserRepository;
import com.example.evalhub.security.AuthenticatedUser;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "evalhub.mail.enabled=true", "evalhub.mail.client-id=test", "evalhub.mail.client-secret=test",
    "evalhub.mail.refresh-token=test", "evalhub.mail.sender-email=sender@example.com",
    "evalhub.mail.encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "evalhub.mail.max-attempts=2", "evalhub.mail.poll-interval-ms=3600000"
})
@AutoConfigureMockMvc
@Transactional
class EvaluatorInvitationIntegrationTests {
    @Autowired EvaluatorInvitationService service;
    @Autowired InvitationSecrets secrets;
    @Autowired InvitationSettings settings;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired AuthController auth;
    @Autowired MockMvc mvc;
    @MockitoBean InvitationSender sender;
    long id;
    @BeforeEach void create() {
        id = service.create(new EvaluatorInvitationService.CreateEvaluatorRequest(
                UUID.randomUUID()+"@example.com", "심사위원", "학과")).id();
    }
    String encrypted() { return jdbc.queryForObject("select encrypted_password from evaluator_invitations where user_id=?", String.class, id); }
    @AfterEach void cleanup() { jdbc.update("delete from users where id=?",id); }
    void due() { jdbc.update("update evaluator_invitations set next_attempt_at=current_timestamp - interval '1 second' where user_id=?",id); }
    @Test void creationHashesPasswordAndSuccessRetainsOnlyEncryptedCopyUntilChange() {
        String password = secrets.decrypt(encrypted(), id);
        assertThat(passwords.matches(password, users.findById(id).orElseThrow().getPassword())).isTrue();
        assertThat(service.get(id).status()).isEqualTo("PENDING");
        when(sender.send(anyString(), anyString())).thenReturn("gmail-id");
        service.tick();
        assertThat(service.get(id).status()).isEqualTo("SENT");
        assertThat(encrypted()).isNotNull();
        verify(sender).send(users.findById(id).orElseThrow().getEmail(), password);
        changePassword(password);
        assertThat(encrypted()).isNull();
        assertThat(service.get(id).status()).isEqualTo("SENT");
    }
    @Test void transientErrorsRetryToLimitAndManualRetryRequiresCooldown() {
        when(sender.send(anyString(), anyString())).thenThrow(new InvitationSender.DeliveryException("GMAIL_UNAVAILABLE",true));
        service.tick();
        assertThat(service.get(id).status()).isEqualTo("RETRY_WAIT");
        due(); service.tick();
        assertThat(service.get(id).status()).isEqualTo("FAILED");
        assertThat(service.get(id).attemptCount()).isEqualTo(2);
        assertThatThrownBy(() -> service.retry(id)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        jdbc.update("update evaluator_invitations set last_attempt_at=current_timestamp - interval '2 minutes' where user_id=?",id);
        assertThat(service.retry(id).status()).isEqualTo("PENDING");
        assertThat(service.get(id).attemptCount()).isZero();
    }
    @Test void expiredPasswordsArePurgedWithoutDispatch() {
        jdbc.update("update evaluator_invitations set expires_at=current_timestamp - interval '1 second' where user_id=?",id);
        service.tick();
        assertThat(encrypted()).isNull();
        assertThat(service.get(id).status()).isEqualTo("EXPIRED");
        verifyNoInteractions(sender);
    }
    @Test void changedPasswordCancelsPendingWork() {
        changePassword(secrets.decrypt(encrypted(),id));
        service.tick();
        assertThat(encrypted()).isNull();
        assertThat(service.get(id).status()).isEqualTo("CANCELLED");
        verifyNoInteractions(sender);
    }
    @Test void disabledDeliveryKeepsQueuedWorkButStillPurgesExpiredSecrets() {
        var disabled = new EvaluatorInvitationService(jdbc, users, passwords, secrets,
                InvitationSecretsTests.settings(false, InvitationSecretsTests.KEY), sender,
                transactionManager);
        disabled.tick();
        assertThat(service.get(id).status()).isEqualTo("PENDING");
        jdbc.update("update evaluator_invitations set expires_at=current_timestamp - interval '1 second' where user_id=?",id);
        disabled.tick();
        assertThat(encrypted()).isNull();
        verifyNoInteractions(sender);
    }
    @Test void staleClaimIsRecoveredByANewServiceInstance() {
        jdbc.update("""
            update evaluator_invitations set status='PROCESSING', claim_token='old',
                locked_until=current_timestamp - interval '1 second', attempt_count=1 where user_id=?
            """,id);
        when(sender.send(anyString(),anyString())).thenReturn("recovered");
        var restarted = new EvaluatorInvitationService(jdbc,users,passwords,secrets,settings,sender,
                transactionManager);
        restarted.tick();
        assertThat(service.get(id).status()).isEqualTo("SENT");
        assertThat(service.get(id).attemptCount()).isEqualTo(2);
    }
    @Test void revokedTokenFailsWithoutAutomaticRetry() {
        when(sender.send(anyString(),anyString())).thenThrow(new InvitationSender.DeliveryException("AUTH_REQUIRED",false));
        service.tick(); service.tick();
        assertThat(service.get(id).status()).isEqualTo("FAILED");
        assertThat(service.get(id).errorCode()).isEqualTo("AUTH_REQUIRED");
        verify(sender,times(1)).send(anyString(),anyString());
    }
    @Test @WithMockUser(roles="MANAGER") void managerCanCreateAndReadButNoPasswordIsExposed() throws Exception {
        mvc.perform(post("/api/evaluators").with(csrf()).contentType("application/json")
                .content("{\"email\":\""+UUID.randomUUID()+"@example.com\",\"name\":\"심사위원\",\"password\":\"ignored\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("EVALUATOR"))
                .andExpect(jsonPath("$.password").doesNotExist());
        mvc.perform(get("/api/evaluators/"+id+"/invitation")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.encryptedPassword").doesNotExist());
        mvc.perform(get("/api/evaluator-invitations")).andExpect(status().isOk());
        mvc.perform(post("/api/users").with(csrf()).contentType("application/json")
                .content("{\"email\":\"bypass@example.com\",\"password\":\"unsafe\",\"role\":\"EVALUATOR\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(roles="EVALUATOR") void evaluatorCannotReadOrRetryInvitations() throws Exception {
        mvc.perform(get("/api/evaluator-invitations")).andExpect(status().isForbidden());
        mvc.perform(post("/api/evaluators/"+id+"/invitation/retry").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/evaluators").with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }
    @Test void deletingAccountCascadesInvitationAndSecret() {
        users.deleteById(id); users.flush();
        assertThat(jdbc.queryForObject("select count(*) from evaluator_invitations where user_id=?",Long.class,id)).isZero();
    }
    @Test @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void committedJobCanBeProcessedByAnotherInstanceOnlyOnce() throws Exception {
        var restarted = new EvaluatorInvitationService(jdbc,users,passwords,secrets,settings,sender,transactionManager);
        var entered = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        when(sender.send(anyString(),anyString())).thenAnswer(call -> {
            entered.countDown();
            if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new AssertionError("Dispatch not released");
            return "concurrent-mail";
        });
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = executor.submit(service::tick);
            try {
                assertThat(entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                var second = executor.submit(restarted::tick);
                second.get(10, java.util.concurrent.TimeUnit.SECONDS);
            } finally { release.countDown(); }
            first.get(10, java.util.concurrent.TimeUnit.SECONDS);
        }
        assertThat(service.get(id).status()).isEqualTo("SENT");
        verify(sender,times(1)).send(anyString(),anyString());
    }
    @Test @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void rolledBackCreationLeavesNeitherAccountNorJob() {
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        Long rolledBack = tx.execute(status -> {
            long created = service.create(new EvaluatorInvitationService.CreateEvaluatorRequest(UUID.randomUUID()+"@example.com",null,null)).id();
            status.setRollbackOnly();
            return created;
        });
        assertThat(users.existsById(rolledBack)).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from evaluator_invitations where user_id=?",Long.class,rolledBack)).isZero();
    }
    @Test void missingLocalKeyRejectsCreationWithoutCreatingAnAccount() {
        var missing = InvitationSecretsTests.settings(false, "");
        var unconfigured = new EvaluatorInvitationService(jdbc,users,passwords,new InvitationSecrets(missing),missing,sender,transactionManager);
        String email=UUID.randomUUID()+"@example.com";
        assertThatThrownBy(() -> unconfigured.create(new EvaluatorInvitationService.CreateEvaluatorRequest(email,null,null)))
                .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(503));
        assertThat(users.findByEmail(email)).isEmpty();
    }
    void changePassword(String current) {
        var principal=AuthenticatedUser.from(users.findById(id).orElseThrow());
        auth.changePassword(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()),
                new ChangePasswordRequest(current,"next-secure-password"));
    }
}
