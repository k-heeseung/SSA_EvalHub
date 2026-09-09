package com.example.evalhub.dto;

import com.example.evalhub.entity.ApplicationFormField;

import java.util.Arrays;
import java.util.List;

public record FormFieldResponse(
        Long id,
        String label,
        String fieldType,
        boolean required,
        Integer displayOrder,
        List<String> options
) {

    public static FormFieldResponse from(ApplicationFormField field) {
        return new FormFieldResponse(
                field.getId(),
                field.getLabel(),
                field.getFieldType(),
                field.isRequired(),
                field.getDisplayOrder(),
                splitOptions(field.getOptions())
        );
    }

    // 줄바꿈으로 저장된 선택지 텍스트를 목록으로 변환한다.
    public static List<String> splitOptions(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
