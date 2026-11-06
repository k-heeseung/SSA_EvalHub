package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Entity
@Table(name = "bonus_items")
@Getter
@NoArgsConstructor
public class BonusItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "program_id", nullable = false)
    private Program program;
    @Column(nullable = false) private String name;
    @Column(precision = 10, scale = 2) private BigDecimal maxScore;
    @Column(nullable = false) private int displayOrder;
    public BonusItem(Program program, String name, BigDecimal maxScore, int displayOrder) {
        this.program = program;
        update(name, maxScore, displayOrder);
    }
    public void update(String name, BigDecimal maxScore, int displayOrder) {
        this.name = name; this.maxScore = maxScore; this.displayOrder = displayOrder;
    }
}
