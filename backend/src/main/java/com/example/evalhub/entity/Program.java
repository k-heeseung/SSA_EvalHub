package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import com.example.evalhub.util.ProgramTimes;

@Entity
@Table(name = "programs")
@org.hibernate.annotations.DynamicUpdate
@Getter
@NoArgsConstructor
public class Program {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProgramType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    private LocalDate applicationStart;

    private LocalDate applicationDeadline;

    private LocalDate evaluationStart;

    private LocalDate evaluationDeadline;

    @Column(columnDefinition = "timestamp with time zone")
    private Instant applicationStartAt;
    @Column(columnDefinition = "timestamp with time zone")
    private Instant applicationDeadlineAt;
    @Column(columnDefinition = "timestamp with time zone")
    private Instant evaluationStartAt;
    @Column(columnDefinition = "timestamp with time zone")
    private Instant evaluationDeadlineAt;

    public void updateSchedule(Instant applicationStartAt, Instant applicationDeadlineAt,
                               Instant evaluationStartAt, Instant evaluationDeadlineAt) {
        this.applicationStartAt = applicationStartAt;
        this.applicationDeadlineAt = applicationDeadlineAt;
        this.evaluationStartAt = evaluationStartAt;
        this.evaluationDeadlineAt = evaluationDeadlineAt;
        this.applicationStart = ProgramTimes.startDate(applicationStartAt);
        this.applicationDeadline = ProgramTimes.lastDate(applicationDeadlineAt);
        this.evaluationStart = ProgramTimes.startDate(evaluationStartAt);
        this.evaluationDeadline = ProgramTimes.lastDate(evaluationDeadlineAt);
    }

    @Column(columnDefinition = "text")
    private String eligibilityCriteria;

    // 지원자 첨부파일 수령 여부. true일 때만 maxAttachments가 의미를 가진다.
    @Column(nullable = false)
    private boolean attachmentsEnabled = false;

    // 지원자가 올릴 수 있는 첨부파일 최대 개수. null이면 제한 없음.
    private Integer maxAttachments;

    // 지원 방식: 개인 지원(INDIVIDUAL) / 팀 지원(TEAM). 지원서 입력 항목이 이에 따라 달라진다.
    @Enumerated(EnumType.STRING)
    @Column(name = "participant_type", nullable = false)
    private ParticipantType participantType = ParticipantType.INDIVIDUAL;

    // 매니저 단독 가산점 사용 여부. true일 때만 maxBonus와 팀별 가산점이 의미를 가진다.
    @Column(name = "bonus_enabled", nullable = false)
    private boolean bonusEnabled = false;

    // 팀당 부여할 수 있는 최대 가산점. null이면 상한 없음.
    @Column(name = "max_bonus", precision = 14, scale = 2)
    private BigDecimal maxBonus;

    @OneToMany(mappedBy = "program", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private java.util.List<BonusItem> bonusItems = new java.util.ArrayList<>();

    @Column(nullable = false)
    private boolean evaluationStarted = false;

    public void markEvaluationStarted() { evaluationStarted = true; }

    public Program(User manager, String title, String description, ProgramType type, LocalDate applicationStart, LocalDate applicationDeadline, LocalDate evaluationStart, LocalDate evaluationDeadline, String eligibilityCriteria) {
        this.manager = manager;
        this.title = title;
        this.description = description;
        this.type = type;
        this.applicationStart = applicationStart;
        this.applicationDeadline = applicationDeadline;
        this.evaluationStart = evaluationStart;
        this.evaluationDeadline = evaluationDeadline;
        this.eligibilityCriteria = eligibilityCriteria;
    }

    public void update(String title, String description, ProgramType type, User manager, LocalDate applicationStart, LocalDate applicationDeadline, LocalDate evaluationStart, LocalDate evaluationDeadline, String eligibilityCriteria) {
        if (title != null) this.title = title;
        if (description != null) this.description = description;
        if (type != null) this.type = type;
        if (manager != null) this.manager = manager;
        if (applicationStart != null) this.applicationStart = applicationStart;
        if (applicationDeadline != null) this.applicationDeadline = applicationDeadline;
        if (evaluationStart != null) this.evaluationStart = evaluationStart;
        if (evaluationDeadline != null) this.evaluationDeadline = evaluationDeadline;
        if (eligibilityCriteria != null) this.eligibilityCriteria = eligibilityCriteria;
    }

    // 첨부파일 설정을 갱신한다. enabled가 false면 최대 개수는 자동으로 비운다.
    public void updateAttachmentSettings(Boolean attachmentsEnabled, Integer maxAttachments) {
        if (attachmentsEnabled != null) {
            this.attachmentsEnabled = attachmentsEnabled;
            this.maxAttachments = attachmentsEnabled ? maxAttachments : null;
        }
    }

    // 가산점 설정을 갱신한다. enabled가 false면 최대 가산점은 자동으로 비운다.
    public void updateBonusSettings(Boolean bonusEnabled, BigDecimal maxBonus) {
        if (bonusEnabled != null) {
            this.bonusEnabled = bonusEnabled;
            this.maxBonus = bonusEnabled ? maxBonus : null;
        }
    }

    public void changeStatus(Status status) {
        this.status = status;
    }

    public void updateParticipantType(ParticipantType participantType) {
        if (participantType != null) this.participantType = participantType;
    }
}
