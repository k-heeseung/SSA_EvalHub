package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "teams")
@Getter
@NoArgsConstructor
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantType participantType = ParticipantType.TEAM;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TeamStatus status = TeamStatus.PENDING;

    @Column(nullable = false)
    private String displayName;

    @Column(columnDefinition = "text")
    private String submissionUrl;

    @Column(columnDefinition = "text")
    private String notes;

    // 지원자가 입력한 본인/팀원 정보 (JSON). ApplicantInfo 형식.
    @Column(name = "applicant_info", columnDefinition = "text")
    private String applicantInfo;

    // 지원자 대표 연락처. 숫자만 남긴 정규화 형태로 저장한다. (PhoneNumbers.normalize)
    // applicantInfo JSON 안에도 같은 값이 들어가지만, 검색·중복 확인이 가능하도록 컬럼으로 분리했다.
    // 두 값은 항상 applyApplicantInfo()에서 함께 갱신되며, 조회 시에는 이 컬럼을 기준으로 삼는다.
    @Column(name = "participant_phone", length = 20)
    private String participantPhone;

    // 매니저가 부여한 가산점과 사유(선택). 프로그램에 가산점이 활성화된 경우에만 사용한다.
    @Column(name = "bonus_score")
    private BigDecimal bonusScore;

    @Column(name = "bonus_reason", columnDefinition = "text")
    private String bonusReason;

    public Team(Program program, String name, ParticipantType participantType, String description, String displayName, String submissionUrl, String notes) {
        this.program = program;
        this.name = name;
        this.participantType = participantType;
        this.description = description;
        this.displayName = displayName;
        this.submissionUrl = submissionUrl;
        this.notes = notes;
    }

    public void update(String name, String description, String displayName, String submissionUrl, String notes) {
        this.name = name;
        this.description = description;
        this.displayName = displayName;
        this.submissionUrl = submissionUrl;
        this.notes = notes;
    }

    public void changeStatus(TeamStatus status) {
        this.status = status;
    }

    // 매니저 단독 가산점과 사유를 갱신한다.
    public void updateBonus(BigDecimal bonusScore, String bonusReason) {
        this.bonusScore = bonusScore;
        this.bonusReason = bonusReason;
    }

    // 지원자가 입력한 정보로 표시 이름과 본인/팀원 정보를 갱신한다. (매니저가 관리하는 다른 필드는 건드리지 않음)
    // participantPhone은 정규화된 값을 넘겨받아 JSON과 함께 갱신한다.
    public void applyApplicantInfo(String name, String applicantInfo, String participantPhone) {
        if (name != null && !name.isBlank()) {
            this.name = name;
            this.displayName = name;
        }
        this.applicantInfo = applicantInfo;
        this.participantPhone = participantPhone;
    }

    public void updateParticipantType(ParticipantType participantType) {
        if (participantType != null) this.participantType = participantType;
    }
}
