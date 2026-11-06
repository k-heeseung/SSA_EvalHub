package com.example.evalhub.dto;
import java.math.BigDecimal;
public record BonusItemRequest(Long id, String name, BigDecimal maxScore) {}
