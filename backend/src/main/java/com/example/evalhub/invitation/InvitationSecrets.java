package com.example.evalhub.invitation;

import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

@Component
public class InvitationSecrets {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789".toCharArray();
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+");
    private final SecretKeySpec key;
    public InvitationSecrets(InvitationSettings settings) {
        String configured = settings.encryptionKey();
        if (configured == null || configured.isBlank()) {
            if (settings.enabled()) throw new IllegalArgumentException("Mail encryption-key is required.");
            key = null;
        } else {
            byte[] decoded = Base64.getDecoder().decode(configured);
            if (decoded.length != 32) throw new IllegalArgumentException("Mail encryption-key must be a Base64 encoded 32-byte key.");
            key = new SecretKeySpec(decoded, "AES");
        }
    }
    public boolean configured() { return key != null; }
    public static boolean validEmail(String email) {
        return email != null && email.length() <= 254 && EMAIL.matcher(email).matches();
    }
    public String generatePassword() {
        StringBuilder result = new StringBuilder(16);
        for (int i = 0; i < 16; i++) result.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        return result.toString();
    }
    public String encrypt(String value, long userId) {
        try {
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            Cipher cipher = cipher(Cipher.ENCRYPT_MODE, nonce, userId);
            // Versioned envelope: v1.nonce.ciphertext (ciphertext includes the authentication tag).
            return "v1." + Base64.getEncoder().encodeToString(nonce) + "."
                    + Base64.getEncoder().encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException("Cannot encrypt invitation password."); }
    }
    public String decrypt(String envelope, long userId) {
        try {
            String[] parts = envelope.split("\\.");
            if (parts.length != 3 || !parts[0].equals("v1")) throw new IllegalArgumentException();
            Cipher cipher = cipher(Cipher.DECRYPT_MODE, Base64.getDecoder().decode(parts[1]), userId);
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new IllegalStateException("Cannot decrypt invitation password."); }
    }
    private Cipher cipher(int mode, byte[] nonce, long userId) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(128, nonce));
        cipher.updateAAD(("evalhub-invitation:" + userId).getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
