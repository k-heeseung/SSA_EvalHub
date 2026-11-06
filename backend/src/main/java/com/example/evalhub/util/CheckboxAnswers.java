package com.example.evalhub.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class CheckboxAnswers {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private CheckboxAnswers() {
    }

    // 선택지는 JSON 배열 문자열로 저장된다. 빈 값이나 잘못된 형식은 미선택이다.
    public static int countSelections(String value) {
        if (value == null || value.isBlank()) return 0;
        try {
            JsonNode parsed = MAPPER.readTree(value);
            if (!parsed.isArray()) return 0;
            int count = 0;
            for (JsonNode selection : parsed) {
                if (selection.isTextual() && !selection.textValue().isBlank()) count++;
            }
            return count;
        } catch (JsonProcessingException e) {
            return 0;
        }
    }
}
