package com.example.evalhub;

import com.example.evalhub.util.PhoneNumbers;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

// 전화번호 정규화/표시 규칙 검증. 프론트의 utils/phone.js와 같은 규칙을 따라야 한다.
class PhoneNumbersTest {

    @Test
    void 입력_형식이_달라도_같은_값으로_정규화된다() {
        assertEquals("01012345678", PhoneNumbers.normalize("010-1234-5678"));
        assertEquals("01012345678", PhoneNumbers.normalize("01012345678"));
        assertEquals("01012345678", PhoneNumbers.normalize("010 1234 5678"));
        assertEquals("01012345678", PhoneNumbers.normalize(" (010) 1234-5678 "));
        assertEquals("01012345678", PhoneNumbers.normalize("+82 10-1234-5678"));
    }

    @Test
    void 값이_비어_있으면_null을_반환한다() {
        assertNull(PhoneNumbers.normalize(null));
        assertNull(PhoneNumbers.normalize(""));
        assertNull(PhoneNumbers.normalize("   "));
    }

    @Test
    void 자릿수가_맞지_않으면_예외를_던진다() {
        assertThrows(IllegalArgumentException.class, () -> PhoneNumbers.normalize("010-1234"));
        assertThrows(IllegalArgumentException.class, () -> PhoneNumbers.normalize("010-1234-56789"));
        assertThrows(IllegalArgumentException.class, () -> PhoneNumbers.normalize("이메일주소"));
        assertThrows(IllegalArgumentException.class, () -> PhoneNumbers.normalize("+1 415 555 0100"));
    }

    @Test
    void 지역번호와_대표번호도_허용한다() {
        assertEquals("021234567", PhoneNumbers.normalize("02-123-4567"));
        assertEquals("0212345678", PhoneNumbers.normalize("02-1234-5678"));
        assertEquals("0311234567", PhoneNumbers.normalize("031-123-4567"));
        assertEquals("15881234", PhoneNumbers.normalize("1588-1234"));
    }

    @Test
    void 임시저장용_toDigits는_자릿수를_검증하지_않는다() {
        assertEquals("0101234", PhoneNumbers.toDigits("010-1234"));
        assertNull(PhoneNumbers.toDigits("   "));
        assertNull(PhoneNumbers.toDigits("이름"));
    }

    @Test
    void 표시용_하이픈을_붙인다() {
        assertEquals("010-1234-5678", PhoneNumbers.format("01012345678"));
        assertEquals("02-123-4567", PhoneNumbers.format("021234567"));
        assertEquals("02-1234-5678", PhoneNumbers.format("0212345678"));
        assertEquals("031-123-4567", PhoneNumbers.format("0311234567"));
        assertEquals("1588-1234", PhoneNumbers.format("15881234"));
    }

    @Test
    void 정규화와_표시는_서로_역순이다() {
        String stored = PhoneNumbers.normalize("010-1234-5678");
        assertEquals("010-1234-5678", PhoneNumbers.format(stored));
        assertEquals(stored, PhoneNumbers.normalize(PhoneNumbers.format(stored)));
    }
}
