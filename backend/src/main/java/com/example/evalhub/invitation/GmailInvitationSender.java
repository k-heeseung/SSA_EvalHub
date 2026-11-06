package com.example.evalhub.invitation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;

@Component
public class GmailInvitationSender implements InvitationSender {
    private final InvitationSettings settings;
    private final ObjectMapper json;
    private final HttpClient http;
    private String accessToken;
    private Instant tokenExpires = Instant.EPOCH;
    @org.springframework.beans.factory.annotation.Autowired
    public GmailInvitationSender(InvitationSettings settings, ObjectMapper json) {
        this(settings, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }
    GmailInvitationSender(InvitationSettings settings, ObjectMapper json, HttpClient http) {
        this.settings = settings; this.json = json; this.http = http;
    }
    @Override public String send(String recipient, String temporaryPassword) {
        if (!settings.enabled()) throw new DeliveryException("MAIL_DISABLED", false);
        for (int attempt = 0; attempt < 2; attempt++) {
            String token = token();
            String body;
            try { body = json.writeValueAsString(Map.of("raw", encodeMessage(settings.senderEmail(), recipient,
                    temporaryPassword, settings.loginUrl()))); }
            catch (Exception e) { throw new DeliveryException("MESSAGE_ENCODING_ERROR", false); }
            HttpResponse<String> response = request(HttpRequest.newBuilder(URI.create("https://gmail.googleapis.com/gmail/v1/users/me/messages/send"))
                    .timeout(Duration.ofSeconds(30)).header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build());
            if (response.statusCode() == 401 && attempt == 0) { invalidateToken(token); continue; }
            if (response.statusCode() / 100 != 2) throw failure(response, false);
            String id = parse(response.body()).path("id").asText();
            if (id.isBlank()) throw new DeliveryException("INVALID_GMAIL_RESPONSE", false);
            return id;
        }
        throw new DeliveryException("AUTH_REQUIRED", false);
    }
    private synchronized String token() {
        if (accessToken != null && Instant.now().isBefore(tokenExpires)) return accessToken;
        String form = "grant_type=refresh_token&client_id=" + encode(settings.clientId())
                + "&client_secret=" + encode(settings.clientSecret()) + "&refresh_token=" + encode(settings.refreshToken());
        HttpResponse<String> response = request(HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
                .timeout(Duration.ofSeconds(20)).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build());
        if (response.statusCode() / 100 != 2) throw failure(response, true);
        JsonNode data = parse(response.body());
        accessToken = data.path("access_token").asText();
        if (accessToken.isBlank()) throw new DeliveryException("AUTH_REQUIRED", false);
        tokenExpires = Instant.now().plusSeconds(Math.max(1, data.path("expires_in").asLong(3600) - 60));
        return accessToken;
    }
    private synchronized void invalidateToken(String used) {
        if (used.equals(accessToken)) { accessToken = null; tokenExpires = Instant.EPOCH; }
    }
    private HttpResponse<String> request(HttpRequest request) {
        try { return http.send(request, HttpResponse.BodyHandlers.ofString()); }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new DeliveryException("NETWORK_INTERRUPTED", true);
        } catch (java.io.IOException e) { throw new DeliveryException("NETWORK_ERROR", true); }
    }
    private JsonNode parse(String body) {
        try { return json.readTree(body); }
        catch (Exception e) { throw new DeliveryException("INVALID_GMAIL_RESPONSE", false); }
    }
    private DeliveryException failure(HttpResponse<String> response, boolean oauth) {
        int status = response.statusCode();
        if (status == 429) return new DeliveryException("RATE_LIMITED", true, retryAfter(response));
        if (status >= 500) return new DeliveryException("GMAIL_UNAVAILABLE", true, retryAfter(response));
        if (oauth || status == 401) return new DeliveryException("AUTH_REQUIRED", false);
        if (status == 403) {
            JsonNode errors = parse(response.body()).path("error").path("errors");
            for (JsonNode error : errors) {
                String reason = error.path("reason").asText();
                if (reason.equals("rateLimitExceeded") || reason.equals("userRateLimitExceeded"))
                    return new DeliveryException("RATE_LIMITED", true, retryAfter(response));
                if (reason.equals("dailyLimitExceeded")) return new DeliveryException("DAILY_LIMIT", false);
            }
            return new DeliveryException("PERMISSION_DENIED", false);
        }
        return new DeliveryException("INVALID_REQUEST", false);
    }
    private long retryAfter(HttpResponse<String> response) {
        String value = response.headers().firstValue("Retry-After").orElse("0");
        try { return Math.max(0, Long.parseLong(value)); }
        catch (NumberFormatException e) {
            try { return Math.max(0, Duration.between(Instant.now(), ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).getSeconds()); }
            catch (Exception ignored) { return 0; }
        }
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    static String encodeMessage(String sender, String recipient, String password, String loginUrl) {
        if (!InvitationSecrets.validEmail(sender) || !InvitationSecrets.validEmail(recipient))
            throw new IllegalArgumentException("Invalid email address.");
        String body = "심사위원 계정이 생성되었습니다.\n\n로그인 아이디: " + recipient + "\n임시 비밀번호: " + password
                + "\n\n임시 비밀번호는 로그인 후 설정 화면에서 변경할 수 있습니다.\n로그인: " + loginUrl + "\n";
        String subject = Base64.getEncoder().encodeToString("[평가ON] 심사위원 계정 안내".getBytes(StandardCharsets.UTF_8));
        String mime = "From: " + sender + "\r\nTo: " + recipient + "\r\nSubject: =?UTF-8?B?" + subject
                + "?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
                + Base64.getMimeEncoder().encodeToString(body.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mime.getBytes(StandardCharsets.UTF_8));
    }
}
