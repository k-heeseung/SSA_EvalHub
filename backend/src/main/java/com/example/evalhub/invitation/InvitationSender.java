package com.example.evalhub.invitation;

public interface InvitationSender {
    String send(String recipient, String temporaryPassword);

    class DeliveryException extends RuntimeException {
        private final String code;
        private final boolean retryable;
        private final long retryAfterSeconds;
        public DeliveryException(String code, boolean retryable) { this(code, retryable, 0); }
        public DeliveryException(String code, boolean retryable, long retryAfterSeconds) {
            super(code);
            this.code = code;
            this.retryable = retryable;
            this.retryAfterSeconds = retryAfterSeconds;
        }
        public String code() { return code; }
        public boolean retryable() { return retryable; }
        public long retryAfterSeconds() { return retryAfterSeconds; }
    }
}
