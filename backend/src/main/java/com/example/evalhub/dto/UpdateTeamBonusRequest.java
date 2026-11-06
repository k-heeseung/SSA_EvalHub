package com.example.evalhub.dto;
import java.math.BigDecimal;
import java.util.List;
public record UpdateTeamBonusRequest(List<Item> scores) {
    public record Item(Long itemId, BigDecimal score) {}
}
