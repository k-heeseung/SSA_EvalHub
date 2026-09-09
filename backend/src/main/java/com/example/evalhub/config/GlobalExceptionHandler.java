package com.example.evalhub.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * 서비스 계층이 의도적으로 던지는 예외는 모두 ResponseStatusException 계열이라 Spring이 그대로 처리한다.
 * 여기서는 그대로 두면 500으로 나가 원인 파악이 어려운 예외만 골라 상태 코드를 바로잡는다.
 *
 * Exception 전체를 받는 핸들러는 두지 않는다. AccessDeniedException처럼 Spring Security가
 * 403으로 변환해야 할 예외까지 가로채 500으로 만들어 버리기 때문이다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * DB 제약 조건 위반(유니크·NOT NULL·FK)을 409로 변환한다.
     * 예: 같은 프로그램에 지원서를 두 번 만들려는 요청(uq_applications_program_applicant).
     *
     * 응답 본문의 키는 Spring Boot 기본 오류 응답과 맞춘다. 프론트가 전역적으로
     * err.response.data.message를 읽기 때문에 message 키가 없으면 안내 문구가 사라진다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        // 어떤 제약이 걸렸는지는 스택 트레이스에만 남기고, 응답에는 내부 정보를 노출하지 않는다.
        log.error("데이터 제약 조건 위반", e);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "status", HttpStatus.CONFLICT.value(),
                "error", HttpStatus.CONFLICT.getReasonPhrase(),
                "message", "요청을 처리하지 못했습니다. 이미 등록된 값이거나 다른 데이터와 충돌합니다."
        ));
    }
}
