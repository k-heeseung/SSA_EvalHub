package com.example.evalhub.dto;

// 지원자 회원가입 요청. role은 항상 MEMBER로 고정 생성된다.
public record SignupRequest(
        String email,
        String password,
        String name,
        String phone,
        String department
) {
}
