package com.example.evalhub.invitation;

import com.example.evalhub.dto.UserResponse;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class EvaluatorInvitationService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final InvitationSecrets secrets;
    private final InvitationSettings settings;
    private final InvitationSender sender;
    private final TransactionTemplate transactions;

    public EvaluatorInvitationService(JdbcTemplate jdbc, UserRepository users, PasswordEncoder passwords,
            InvitationSecrets secrets, InvitationSettings settings, InvitationSender sender,
            PlatformTransactionManager manager) {
        this.jdbc = jdbc; this.users = users; this.passwords = passwords; this.secrets = secrets;
        this.settings = settings; this.sender = sender; this.transactions = new TransactionTemplate(manager);
    }
    public record CreateEvaluatorRequest(String email, String name, String department) {}
    public record InvitationView(long userId, String status, int attemptCount, Instant nextAttemptAt,
            Instant expiresAt, Instant lastAttemptAt, Instant sentAt, String errorCode, boolean retryAllowed) {}
    public record InvitationList(boolean deliveryEnabled, boolean creationEnabled, List<InvitationView> invitations) {}
    private record Claim(long userId, String token) {}
    private record Job(long userId, String email, String status, String encryptedPassword, int attempts,
            Instant expiresAt, String claimToken) {}

    @Transactional
    public UserResponse create(CreateEvaluatorRequest request) {
        if (!secrets.configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "안내 메일 암호화 키가 설정되지 않았습니다. 로컬 서버의 EVALHUB_MAIL_ENCRYPTION_KEY를 설정해주세요.");
        String email = request.email() == null ? "" : request.email().trim().toLowerCase(Locale.ROOT);
        if (!InvitationSecrets.validEmail(email) || tooLong(request.name()) || tooLong(request.department()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "올바른 이메일과 255자 이하의 이름·학과를 입력해주세요.");
        if (users.findByEmailIgnoreCase(email).isPresent()) throw duplicate();
        String temporaryPassword = secrets.generatePassword();
        try {
            User user = users.saveAndFlush(new User(email, passwords.encode(temporaryPassword), Role.EVALUATOR,
                    trim(request.name()), trim(request.department())));
            jdbc.update("""
                insert into evaluator_invitations(user_id, recipient_email, status, encrypted_password, expires_at)
                values (?, ?, 'PENDING', ?, ?)
                """, user.getId(), email, secrets.encrypt(temporaryPassword, user.getId()),
                    Timestamp.from(Instant.now().plus(settings.retention())));
            return UserResponse.from(user);
        } catch (DataIntegrityViolationException e) { throw duplicate(); }
    }
    private boolean tooLong(String value) { return value != null && value.length() > 255; }
    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ResponseStatusException duplicate() { return new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다."); }

    @Transactional(readOnly = true)
    public InvitationList list() {
        return new InvitationList(settings.enabled(), secrets.configured(), jdbc.query(
                "select * from evaluator_invitations order by user_id", this::view));
    }
    @Transactional(readOnly = true)
    public InvitationView get(long userId) {
        requireEvaluator(userId);
        return jdbc.query("select * from evaluator_invitations where user_id = ?", this::view, userId)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "안내 메일 발송 이력이 없습니다."));
    }
    @Transactional
    public InvitationView retry(long userId) {
        lockUser(userId);
        requireEvaluator(userId);
        int changed = jdbc.update("""
            update evaluator_invitations set status = 'PENDING', next_attempt_at = current_timestamp,
                attempt_count = 0, last_error_code = null, claim_token = null, locked_until = null
            where user_id = ? and status = 'FAILED' and encrypted_password is not null
                and expires_at > current_timestamp
                and (last_attempt_at is null or last_attempt_at < current_timestamp - interval '1 minute')
            """, userId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "실패한 메일만 재시도할 수 있습니다. 비밀번호 변경·보관 기한 종료 여부를 확인하고 최근 시도 후 1분 뒤 다시 요청해주세요.");
        return get(userId);
    }
    // Called within the password-change transaction, after locking the user row.
    @Transactional
    public void passwordChanged(long userId) {
        jdbc.update("""
            update evaluator_invitations set encrypted_password = null, password_deleted_at = current_timestamp,
                status = case when status = 'SENT' then 'SENT' else 'CANCELLED' end,
                claim_token = null, locked_until = null
            where user_id = ? and encrypted_password is not null
            """, userId);
    }
    private void requireEvaluator(long id) {
        if (jdbc.queryForObject("select count(*) from users where id = ? and role = 'EVALUATOR'", Long.class, id) != 1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "심사위원을 찾을 수 없습니다.");
    }
    private boolean lockUser(long id) {
        return !jdbc.queryForList("select id from users where id = ? for update", Long.class, id).isEmpty();
    }
    private InvitationView view(ResultSet row, int index) throws SQLException {
        String status = row.getString("status");
        Instant expires = instant(row, "expires_at");
        Instant lastAttempt = instant(row, "last_attempt_at");
        return new InvitationView(row.getLong("user_id"), status, row.getInt("attempt_count"),
                List.of("PENDING", "RETRY_WAIT").contains(status) ? instant(row, "next_attempt_at") : null,
                expires, lastAttempt, instant(row, "sent_at"), row.getString("last_error_code"),
                status.equals("FAILED") && row.getString("encrypted_password") != null
                        && expires.isAfter(Instant.now()) && (lastAttempt == null || lastAttempt.isBefore(Instant.now().minusSeconds(60))));
    }
    private Instant instant(ResultSet row, String name) throws SQLException {
        Timestamp value = row.getTimestamp(name); return value == null ? null : value.toInstant();
    }
    public void tick() {
        // Cleanup also runs while Gmail delivery is disabled.
        transactions.executeWithoutResult(tx -> jdbc.update("""
            update evaluator_invitations set encrypted_password = null, password_deleted_at = current_timestamp,
                status = case when status = 'SENT' then 'SENT' else 'EXPIRED' end,
                claim_token = null, locked_until = null
            where encrypted_password is not null and expires_at <= current_timestamp
            """));
        if (!settings.enabled()) return;
        for (int i = 0; i < 10; i++) {
            Claim claim = transactions.execute(tx -> claim());
            if (claim == null) break;
            transactions.executeWithoutResult(tx -> deliver(claim));
        }
    }
    private Claim claim() {
        // A crashed last attempt must become terminal rather than remaining PROCESSING forever.
        jdbc.update("""
            update evaluator_invitations set status = 'FAILED', last_error_code = 'ATTEMPTS_EXHAUSTED',
                claim_token = null, locked_until = null
            where status = 'PROCESSING' and locked_until < current_timestamp and attempt_count >= ?
            """, settings.maxAttempts());
        List<Long> candidates = jdbc.queryForList("""
            select user_id from evaluator_invitations
            where encrypted_password is not null and expires_at > current_timestamp and attempt_count < ?
                and ((status in ('PENDING','RETRY_WAIT') and next_attempt_at <= current_timestamp)
                    or (status = 'PROCESSING' and locked_until < current_timestamp))
            order by next_attempt_at, id limit 1 for update skip locked
            """, Long.class, settings.maxAttempts());
        if (candidates.isEmpty()) return null;
        long userId = candidates.getFirst();
        String token = UUID.randomUUID().toString();
        jdbc.update("""
            update evaluator_invitations set status = 'PROCESSING', claim_token = ?,
                locked_until = current_timestamp + interval '5 minutes',
                attempt_count = attempt_count + 1, last_attempt_at = current_timestamp
            where user_id = ?
            """, token, userId);
        return new Claim(userId, token);
    }
    private void deliver(Claim claim) {
        // Always user -> invitation, matching password changes/deletion. Keep these locks through the
        // bounded HTTP call so a password change cannot commit before an old password is dispatched.
        if (!lockUser(claim.userId())) return;
        List<Job> jobs = jdbc.query("select * from evaluator_invitations where user_id = ? for update",
                (row, n) -> new Job(row.getLong("user_id"), row.getString("recipient_email"), row.getString("status"),
                        row.getString("encrypted_password"), row.getInt("attempt_count"), instant(row, "expires_at"),
                        row.getString("claim_token")), claim.userId());
        if (jobs.isEmpty()) return;
        Job job = jobs.getFirst();
        if (!"PROCESSING".equals(job.status()) || !claim.token().equals(job.claimToken())) return;
        if (job.encryptedPassword() == null || !job.expiresAt().isAfter(Instant.now())) {
            jdbc.update("""
                update evaluator_invitations set status = 'EXPIRED', encrypted_password = null,
                    password_deleted_at = current_timestamp, locked_until = null, claim_token = null where user_id = ?
                """, job.userId());
            return;
        }
        try {
            String accountStatus = jdbc.queryForObject("select status from users where id = ?", String.class, job.userId());
            if (!"ACTIVE".equals(accountStatus)) throw new InvitationSender.DeliveryException("ACCOUNT_INACTIVE", false);
            String password;
            try { password = secrets.decrypt(job.encryptedPassword(), job.userId()); }
            catch (IllegalStateException e) { throw new InvitationSender.DeliveryException("DECRYPTION_FAILED", false); }
            String messageId = sender.send(job.email(), password);
            jdbc.update("""
                update evaluator_invitations set status = 'SENT', gmail_message_id = ?, sent_at = current_timestamp,
                    last_error_code = null, locked_until = null, claim_token = null where user_id = ?
                """, messageId, job.userId());
        } catch (InvitationSender.DeliveryException error) {
            long backoff = Math.min(21600, 30L * (1L << Math.min(job.attempts() - 1, 9)))
                    + ThreadLocalRandom.current().nextLong(15);
            Instant next = Instant.now().plusSeconds(Math.max(backoff, Math.min(error.retryAfterSeconds(), 604800)));
            boolean retry = error.retryable() && job.attempts() < settings.maxAttempts() && next.isBefore(job.expiresAt());
            jdbc.update("""
                update evaluator_invitations set status = ?, next_attempt_at = ?, last_error_code = ?,
                    locked_until = null, claim_token = null where user_id = ?
                """, retry ? "RETRY_WAIT" : "FAILED", Timestamp.from(next), error.code(), job.userId());
        }
    }
}
