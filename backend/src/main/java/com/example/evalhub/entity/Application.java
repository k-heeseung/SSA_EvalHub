package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "applications")
@Getter
@NoArgsConstructor
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    // 제출 대상 팀. 초안 생성 시 함께 만들어지며, PDF 첨부는 이 팀에 연결된다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status = ApplicationStatus.DRAFT;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Application(Program program, User applicant, Team team) {
        this.program = program;
        this.applicant = applicant;
        this.team = team;
        this.status = ApplicationStatus.DRAFT;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    // 제출 대상 팀을 연결한다. 초안이 팀 없이 만들어진 경우(구버전 데이터) 보정에 사용한다.
    public void assignTeam(Team team) {
        this.team = team;
    }

    // 임시저장·수정 시 갱신 시각만 올린다.
    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    public void submit() {
        this.status = ApplicationStatus.SUBMITTED;
        this.submittedAt = LocalDateTime.now();
        touch();
    }

    // 제출한 지원서를 다시 초안 상태로 되돌린다 (수정 진입 시).
    public void reopen() {
        this.status = ApplicationStatus.DRAFT;
        this.submittedAt = null;
        touch();
    }

    public boolean isSubmitted() {
        return this.status == ApplicationStatus.SUBMITTED;
    }
}
