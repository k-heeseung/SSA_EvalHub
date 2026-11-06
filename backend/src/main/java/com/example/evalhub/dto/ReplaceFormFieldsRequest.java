package com.example.evalhub.dto;

import java.util.List;

// 지원 양식 항목 목록을 한 번에 저장하기 위한 요청.
// 기존 항목은 id를 실어 보내면 제자리에서 수정되고, id가 null이면 새 항목으로 추가된다.
// 요청에 없는 기존 항목만 삭제된다. (항목을 통째로 지웠다 다시 만들면 답변이 cascade로 함께 삭제된다)
public record ReplaceFormFieldsRequest(
        List<Item> fields
) {

    public record Item(
            Long id,
            String label,
            String fieldType,
            boolean required,
            List<String> options
    ) {
    }
}
