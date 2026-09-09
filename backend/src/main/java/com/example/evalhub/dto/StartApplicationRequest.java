package com.example.evalhub.dto;

// 프로그램 지원 시작(초안 생성) 요청. 이미 초안이 있으면 기존 지원서를 반환한다.
public record StartApplicationRequest(
        String teamName
) {
}
