package com.example.evalhub.dto;
import com.example.evalhub.entity.BonusItem;
import java.math.BigDecimal;
public record BonusItemResponse(Long id, String name, BigDecimal maxScore, int displayOrder) {
    public static BonusItemResponse from(BonusItem item) {
        return new BonusItemResponse(item.getId(), item.getName(), item.getMaxScore(), item.getDisplayOrder());
    }
}
