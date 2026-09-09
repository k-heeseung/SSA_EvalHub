package com.example.evalhub.dto;

import java.util.List;

// 지원 양식 항목 전체를 한 번에 교체(replace-all)하기 위한 요청.
public record ReplaceFormFieldsRequest(
        List<Item> fields
) {

    public record Item(
            String label,
            String fieldType,
            boolean required,
            List<String> options
    ) {
    }
}
