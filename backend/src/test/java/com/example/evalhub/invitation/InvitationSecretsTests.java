package com.example.evalhub.invitation;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;

class InvitationSecretsTests {
    static InvitationSettings settings(boolean enabled, String key) {
        return new InvitationSettings(enabled, "client", "secret", "refresh", "sender@example.com",
                "http://localhost:3000/login", key, Duration.ofDays(7), 2);
    }
    static final String KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    @Test void passwordsAreRandomAndEncryptedWithUniqueNonceAndAccountBinding() {
        var secrets = new InvitationSecrets(settings(false, KEY));
        String password = secrets.generatePassword();
        assertThat(password).hasSize(16).matches("[A-Za-z2-9]+").isNotEqualTo(secrets.generatePassword());
        String encrypted = secrets.encrypt(password, 1);
        assertThat(encrypted).doesNotContain(password).isNotEqualTo(secrets.encrypt(password, 1));
        assertThat(secrets.decrypt(encrypted, 1)).isEqualTo(password);
        assertThatThrownBy(() -> secrets.decrypt(encrypted, 2)).isInstanceOf(IllegalStateException.class);
        var wrongKey = new InvitationSecrets(settings(false, "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="));
        assertThatThrownBy(() -> wrongKey.decrypt(encrypted, 1)).isInstanceOf(IllegalStateException.class);
    }
    @Test void absentKeyIsAllowedOnlyForDisabledStartupAndInvalidKeysFailFast() {
        assertThat(new InvitationSecrets(settings(false, "")).configured()).isFalse();
        assertThatThrownBy(() -> new InvitationSecrets(settings(true, ""))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new InvitationSecrets(settings(false, "YWJj"))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void headersCannotContainInjectedLines() {
        assertThat(InvitationSecrets.validEmail("judge@example.com\r\nBcc: other@example.com")).isFalse();
        assertThat(InvitationSecrets.validEmail("judge+test@example.com")).isTrue();
    }
}
