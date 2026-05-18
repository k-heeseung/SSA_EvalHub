package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "program_participants")
@Getter
@NoArgsConstructor
public class ProgramParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @Column(nullable = false)
    private String displayName;

    @Column(columnDefinition = "text")
    private String submissionUrl;

    @Column(columnDefinition = "text")
    private String notes;

    public ProgramParticipant(Program program, Team team, String displayName, String submissionUrl, String notes) {
        this.program = program;
        this.team = team;
        this.displayName = displayName;
        this.submissionUrl = submissionUrl;
        this.notes = notes;
    }
}
