package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Entity
@Table(name = "team_bonus_scores", uniqueConstraints = @UniqueConstraint(columnNames = {"team_id", "bonus_item_id"}))
@Getter
@NoArgsConstructor
public class TeamBonusScore {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "team_id", nullable = false)
    private Team team;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "bonus_item_id", nullable = false)
    private BonusItem bonusItem;
    @Column(precision = 10, scale = 2) private BigDecimal score;
    public TeamBonusScore(Team team, BonusItem bonusItem, BigDecimal score) {
        this.team = team; this.bonusItem = bonusItem; this.score = score;
    }
    public void update(BigDecimal score) { this.score = score; }
}
