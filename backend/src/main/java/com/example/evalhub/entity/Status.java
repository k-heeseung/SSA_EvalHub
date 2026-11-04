package com.example.evalhub.entity;

public enum Status {
    DRAFT,       // 작성 중 (미공개)
    SCHEDULED,   // 공개됐으나 지원 시작일 전 (접수 예정)
    RECRUITING,  // 지원 접수 중 (시작일~마감일)
    PENDING_EVALUATION, // 지원 마감 후 평가 시작일 전 (평가 대기)
    ACTIVE,      // 평가 시작일~평가 마감일 (평가 진행)
    INACTIVE     // 평가 마감 후 (평가 완료) / 비활성
}