package com.example.evalhub.invitation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class GmailInvitationSenderTests {
    @SuppressWarnings("unchecked")
    private HttpResponse<String> response(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Retry-After", java.util.List.of("120")), (a,b) -> true));
        return response;
    }
    @Test void messageContainsExactKoreanTemplateAndBase64UrlMime() {
        String mime = new String(Base64.getUrlDecoder().decode(GmailInvitationSender.encodeMessage(
                "sender@example.com", "judge@example.com", "random-password", "http://localhost:3000/login")), StandardCharsets.UTF_8);
        assertThat(mime).contains("To: judge@example.com\r\n", "Content-Type: text/plain; charset=UTF-8");
        String subject = mime.substring(mime.indexOf("Subject: =?UTF-8?B?") + "Subject: =?UTF-8?B?".length()).split("\\?=")[0];
        assertThat(new String(Base64.getDecoder().decode(subject), StandardCharsets.UTF_8)).isEqualTo("[EvalHub] 심사위원 계정 안내");
        String body = new String(Base64.getMimeDecoder().decode(mime.split("\r\n\r\n",2)[1]), StandardCharsets.UTF_8);
        assertThat(body).isEqualTo("심사위원 계정이 생성되었습니다.\n\n로그인 아이디: judge@example.com\n임시 비밀번호: random-password\n\n임시 비밀번호는 로그인 후 설정 화면에서 변경할 수 있습니다.\n로그인: http://localhost:3000/login\n");
    }
    @Test void unauthorizedResponseRefreshesTokenOnceAndSuccessfulTokensAreCached() throws Exception {
        HttpClient http = mock(HttpClient.class);
        doReturn(
                response(200,"{\"access_token\":\"first\",\"expires_in\":3600}"), response(401,"{}"),
                response(200,"{\"access_token\":\"second\",\"expires_in\":3600}"), response(200,"{\"id\":\"mail-1\"}"),
                response(200,"{\"id\":\"mail-2\"}")).when(http).send(any(), any(HttpResponse.BodyHandler.class));
        var sender = new GmailInvitationSender(InvitationSecretsTests.settings(true, InvitationSecretsTests.KEY), new ObjectMapper(), http);
        assertThat(sender.send("judge@example.com", "password")).isEqualTo("mail-1");
        assertThat(sender.send("judge@example.com", "password")).isEqualTo("mail-2");
        ArgumentCaptor<HttpRequest> calls = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http, times(5)).send(calls.capture(), any());
        assertThat(calls.getAllValues().get(3).headers().firstValue("Authorization")).contains("Bearer second");
    }
    @Test void rateLimitAndAuthErrorsHaveDifferentRetryPolicies() throws Exception {
        HttpClient http = mock(HttpClient.class);
        doReturn(
                response(200,"{\"access_token\":\"token\"}"),
                response(403,"{\"error\":{\"errors\":[{\"reason\":\"userRateLimitExceeded\"}]}}")).when(http).send(any(), any(HttpResponse.BodyHandler.class));
        var sender = new GmailInvitationSender(InvitationSecretsTests.settings(true, InvitationSecretsTests.KEY), new ObjectMapper(), http);
        assertThatThrownBy(() -> sender.send("judge@example.com", "password"))
                .isInstanceOfSatisfying(InvitationSender.DeliveryException.class, error -> {
                    assertThat(error.retryable()).isTrue(); assertThat(error.retryAfterSeconds()).isEqualTo(120);
                });
        doReturn(response(400,"{\"error\":\"invalid_grant\"}")).when(http).send(any(), any(HttpResponse.BodyHandler.class));
        var authSender = new GmailInvitationSender(InvitationSecretsTests.settings(true, InvitationSecretsTests.KEY), new ObjectMapper(), http);
        assertThatThrownBy(() -> authSender.send("judge@example.com", "password"))
                .isInstanceOfSatisfying(InvitationSender.DeliveryException.class, error -> {
                    assertThat(error.code()).isEqualTo("AUTH_REQUIRED"); assertThat(error.retryable()).isFalse();
                });
    }
}
