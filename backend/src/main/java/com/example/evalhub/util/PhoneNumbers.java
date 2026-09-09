package com.example.evalhub.util;

// 전화번호 정규화 유틸.
// 입력은 자유 형식(하이픈·공백·괄호·+82)을 허용하고, 저장은 숫자만 남긴 형태로 통일한다.
// 하이픈은 저장하지 않고 화면에 표시할 때 format()으로 붙인다.
// 저장 형식을 통일해야 중복 지원 탐지·검색·문자 발송이 가능하다.
public final class PhoneNumbers {

    private PhoneNumbers() {
    }

    // 국내 번호만 지원한다. 0으로 시작하는 9~11자리(02-123-4567 ~ 010-1234-5678)
    // 또는 1로 시작하는 8자리 대표번호(1588-1234)를 허용한다.
    private static boolean isSupportedLength(String digits) {
        if (digits.startsWith("0")) return digits.length() >= 9 && digits.length() <= 11;
        if (digits.startsWith("1")) return digits.length() == 8;
        return false;
    }

    // 자유 입력 → 저장 형태(숫자만). 값이 비어 있으면 null을 반환한다.
    // 형식이 명백히 잘못된 경우 IllegalArgumentException을 던진다.
    public static String normalize(String raw) {
        String digits = toDigits(raw);
        if (digits == null) {
            // 입력 자체가 비어 있으면 통과시키고, 숫자가 하나도 없는 값은 잘못 입력한 것으로 본다.
            if (raw != null && !raw.trim().isEmpty()) {
                throw new IllegalArgumentException("올바른 전화번호 형식이 아닙니다.");
            }
            return null;
        }
        if (!isSupportedLength(digits)) {
            throw new IllegalArgumentException("올바른 전화번호 형식이 아닙니다.");
        }
        return digits;
    }

    // 자릿수 검증 없이 숫자만 남긴다. 임시저장처럼 아직 입력이 끝나지 않은 값을 받을 때 사용한다.
    // 하이픈이 섞인 값이 DB에 들어가는 것은 막으면서, 작성 중인 번호를 지우지는 않는다.
    public static String toDigits(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;

        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;

        // 국가번호 표기(+82 10-1234-5678)는 국내 표기(01012345678)로 바꾼다.
        if (trimmed.startsWith("+") && digits.startsWith("82")) {
            digits = "0" + digits.substring(2);
        }
        return digits;
    }

    // 잘못된 형식이면 예외 대신 null을 반환한다. 검증 없이 넘어가야 하는 경로에서 사용한다.
    public static String normalizeOrNull(String raw) {
        try {
            return normalize(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static boolean isValid(String raw) {
        try {
            return normalize(raw) != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // 저장 형태(숫자만) → 화면 표시용 하이픈 형식. 알 수 없는 형태면 원본을 그대로 돌려준다.
    public static String format(String normalized) {
        if (normalized == null || normalized.isBlank()) return normalized;
        String d = normalized.replaceAll("[^0-9]", "");

        if (d.length() == 8 && d.startsWith("1")) {
            return d.substring(0, 4) + "-" + d.substring(4);
        }
        if (d.startsWith("02")) {
            // 서울 지역번호는 2자리. 국번이 3자리(9자리)인 옛 번호도 있다.
            if (d.length() == 9) return "02-" + d.substring(2, 5) + "-" + d.substring(5);
            if (d.length() == 10) return "02-" + d.substring(2, 6) + "-" + d.substring(6);
            return d;
        }
        if (d.length() == 10) return d.substring(0, 3) + "-" + d.substring(3, 6) + "-" + d.substring(6);
        if (d.length() == 11) return d.substring(0, 3) + "-" + d.substring(3, 7) + "-" + d.substring(7);
        return d;
    }
}
