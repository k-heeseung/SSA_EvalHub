package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import com.example.evalhub.util.ProgramTimes;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProgramManagementService {

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private final ProgramRepository programRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final EvaluationCriterionRepository criterionRepository;
    private final EvaluationAssignmentRepository assignmentRepository;
    private final ApplicationFormFieldRepository formFieldRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationAnswerRepository answerRepository;
    private final ParticipantAttachmentRepository attachmentRepository;
    private final PasswordEncoder passwordEncoder;

    public ProgramManagementService(
            ProgramRepository programRepository,
            UserRepository userRepository,
            TeamRepository teamRepository,
            TeamMemberRepository teamMemberRepository,
            EvaluationCriterionRepository criterionRepository,
            EvaluationAssignmentRepository assignmentRepository,
            ApplicationFormFieldRepository formFieldRepository,
            ApplicationRepository applicationRepository,
            ApplicationAnswerRepository answerRepository,
            ParticipantAttachmentRepository attachmentRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.programRepository = programRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.criterionRepository = criterionRepository;
        this.assignmentRepository = assignmentRepository;
        this.formFieldRepository = formFieldRepository;
        this.applicationRepository = applicationRepository;
        this.answerRepository = answerRepository;
        this.attachmentRepository = attachmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 프로그램 생성의 기준 데이터만 저장한다. 팀, 질문, 배정은 별도 API에서 단계적으로 등록한다.
    @Transactional
    public ProgramResponse createProgram(CreateProgramRequest request) {
        User manager = request.managerId() == null ? null : userRepository.findById(request.managerId())
                .orElseThrow(() -> notFound("Manager not found."));
        Instant applicationStart = ProgramTimes.resolve(request.applicationStartAt(), request.applicationStart(), null, null, false);
        Instant applicationDeadline = ProgramTimes.resolve(request.applicationDeadlineAt(), request.applicationDeadline(), null, null, true);
        Instant evaluationStart = ProgramTimes.resolve(request.evaluationStartAt(), request.evaluationStart(), null, null, false);
        Instant evaluationDeadline = ProgramTimes.resolve(request.evaluationDeadlineAt(), request.evaluationDeadline(), null, null, true);
        validateProgramDates(applicationStart, applicationDeadline, evaluationStart, evaluationDeadline);

        Program program = new Program(manager, request.title(), request.description(), request.type(), request.applicationStart(), request.applicationDeadline(), request.evaluationStart(), request.evaluationDeadline(), request.eligibilityCriteria());
        program.updateSchedule(applicationStart, applicationDeadline, evaluationStart, evaluationDeadline);
        if (request.status() != null) {
            program.changeStatus(request.status());
        }
        program.updateAttachmentSettings(request.attachmentsEnabled(), request.maxAttachments());
        program.updateParticipantType(request.participantType());
        updateBonusItems(program, request.bonusEnabled(), request.maxBonus(), request.bonusItems());
        if (program.getStatus() != Status.DRAFT) {
            requirePublishDates(ProgramTimes.applicationDeadline(program), ProgramTimes.evaluationDeadline(program));
        }
        Program saved = programRepository.save(program);
        applyAutoStatus(saved); // 지원 기간이 지정되어 있으면 접수중/평가중으로 즉시 반영
        return ProgramResponse.from(saved);
    }

    // 지원자에게 노출할 프로그램 목록: 접수 중(RECRUITING) + 접수 예정(SCHEDULED).
    // 실제 지원 가능 여부는 상태로 구분하며, 지원 시작 전(SCHEDULED)에는 프론트에서 '접수 예정'으로 표시한다.
    @Transactional(readOnly = true)
    public List<ProgramResponse> findOpenPrograms() {
        return programRepository
                .findByStatusInOrderByApplicationDeadlineAtAsc(List.of(Status.RECRUITING, Status.SCHEDULED)).stream()
                .filter(program -> {
                    Status status = ProgramScheduleResponse.from(program).periodStatus();
                    return status == Status.RECRUITING || status == Status.SCHEDULED;
                })
                .map(ProgramResponse::from)
                .toList();
    }

    // 지원·평가 기간에 맞춰 전체 프로그램 상태를 동기화한다. 스케줄러가 주기적으로 호출한다.
    @Transactional
    public int syncProgramStatuses() {
        int changed = 0;
        for (Program program : programRepository.findAll()) {
            if (applyAutoStatus(program)) changed++;
        }
        return changed;
    }

    // 시작 시각은 포함하고 마감 시각은 제외한다. DRAFT와 수동 종료는 유지한다.
    // 평가 기간 연장 시에만 INACTIVE를 다시 계산한다.
    private Status resolveAutoStatus(Program program, boolean reopenInactive) {
        Status current = program.getStatus();
        if (current == Status.DRAFT) return null;
        if (current == Status.INACTIVE && !reopenInactive) return null;

        Instant applicationDeadline = ProgramTimes.applicationDeadline(program);
        if (applicationDeadline == null) return null;

        Instant now = Instant.now();
        Instant applicationStart = ProgramTimes.applicationStart(program);
        if (applicationStart != null && now.isBefore(applicationStart)) return Status.SCHEDULED;
        if (now.isBefore(applicationDeadline)) return Status.RECRUITING;

        Instant evaluationDeadline = ProgramTimes.evaluationDeadline(program);
        if (evaluationDeadline != null && !now.isBefore(evaluationDeadline)) return Status.INACTIVE;

        Instant evaluationStart = ProgramTimes.evaluationStart(program);
        if (evaluationStart != null && now.isBefore(evaluationStart)) return Status.PENDING_EVALUATION;
        return Status.ACTIVE;
    }

    // 단일 프로그램에 자동 상태 규칙을 적용한다. 실제로 바뀌면 true.
    // INACTIVE인 프로그램은 그대로 둔다. 다시 열려면 applyAutoStatus(program, true)를 쓴다.
    private boolean applyAutoStatus(Program program) {
        return applyAutoStatus(program, false);
    }

    private boolean applyAutoStatus(Program program, boolean reopenInactive) {
        Status target = resolveAutoStatus(program, reopenInactive);
        if (target != null && target != program.getStatus()) {
            program.changeStatus(target);
            return true;
        }
        return false;
    }

    // 현재는 전체 프로그램을 반환한다. 인증 도입 후에는 manager 권한에 맞춰 필터링한다.
    @Transactional(readOnly = true)
    public List<ProgramResponse> findPrograms() {
        return programRepository.findAll().stream()
                .map(p -> ProgramResponse.from(
                        p,
                        teamRepository.countByProgramId(p.getId()) - draftTeamIds(p.getId()).size(),
                        assignmentRepository.countByProgramId(p.getId()),
                        assignmentRepository.countByProgramIdAndStatus(p.getId(), AssignmentStatus.SUBMITTED)
                ))
                .toList();
    }

    // 지원 마감일을 바꿀 수 있는 상태.
    // 평가가 시작된 뒤(ACTIVE)나 끝난 뒤(INACTIVE)에 접수 기간을 늘리면 이미 진행된 평가와 어긋나므로 막는다.
    private static final Set<Status> APPLICATION_DEADLINE_EDITABLE = Set.of(
            Status.DRAFT, Status.SCHEDULED, Status.RECRUITING, Status.PENDING_EVALUATION
    );

    // 프로그램 기본 정보(제목, 설명, 유형, 담당자)를 수정한다.
    @Transactional
    public ProgramResponse updateProgram(Long programId, UpdateProgramRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        entityManager.refresh(program, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);

        User manager = request.managerId() == null ? null : userRepository.findById(request.managerId())
                .orElseThrow(() -> notFound("Manager not found."));

        Instant applicationStart = ProgramTimes.resolve(request.applicationStartAt(), request.applicationStart(),
                program.getApplicationStart(), ProgramTimes.applicationStart(program), false);
        Instant applicationDeadline = ProgramTimes.resolve(request.applicationDeadlineAt(), request.applicationDeadline(),
                program.getApplicationDeadline(), ProgramTimes.applicationDeadline(program), true);
        Instant evaluationStart = ProgramTimes.resolve(request.evaluationStartAt(), request.evaluationStart(),
                program.getEvaluationStart(), ProgramTimes.evaluationStart(program), false);
        Instant evaluationDeadline = ProgramTimes.resolve(request.evaluationDeadlineAt(), request.evaluationDeadline(),
                program.getEvaluationDeadline(), ProgramTimes.evaluationDeadline(program), true);
        boolean scheduleChanged = !Objects.equals(ProgramTimes.applicationStart(program), applicationStart)
                || !Objects.equals(ProgramTimes.applicationDeadline(program), applicationDeadline)
                || !Objects.equals(ProgramTimes.evaluationStart(program), evaluationStart)
                || !Objects.equals(ProgramTimes.evaluationDeadline(program), evaluationDeadline);
        if (scheduleChanged) validateProgramDates(applicationStart, applicationDeadline, evaluationStart, evaluationDeadline);

        boolean applicationDeadlineChanged = !Objects.equals(ProgramTimes.applicationDeadline(program), applicationDeadline);
        if (applicationDeadlineChanged && !APPLICATION_DEADLINE_EDITABLE.contains(program.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Application deadline cannot be changed once the evaluation period has started.");
        }

        // 평가 마감일이 실제로 바뀐 경우에만 완료(INACTIVE) 상태를 다시 연다.
        // 제목만 고쳤는데 매니저가 수동으로 종료한 프로그램이 되살아나면 안 되기 때문이다.
        boolean evaluationDeadlineChanged = !Objects.equals(ProgramTimes.evaluationDeadline(program), evaluationDeadline);

        program.update(request.title(), request.description(), request.type(), manager, request.applicationStart(), request.applicationDeadline(), request.evaluationStart(), request.evaluationDeadline(), request.eligibilityCriteria());
        program.updateSchedule(applicationStart, applicationDeadline, evaluationStart, evaluationDeadline);
        program.updateAttachmentSettings(request.attachmentsEnabled(), request.maxAttachments());
        program.updateParticipantType(request.participantType());
        updateBonusItems(program, request.bonusEnabled(), request.maxBonus(), request.bonusItems());
        // 기간이 바뀌면 즉시 재계산한다. 평가 마감일을 늘렸다면 INACTIVE(평가 완료)도 다시 연다.
        applyAutoStatus(program, evaluationDeadlineChanged);
        entityManager.flush();
        return ProgramResponse.from(program);
    }

    // 개설(공개)되는 프로그램은 지원 마감일과 평가 마감일이 모두 있어야 한다. 임시 저장(DRAFT)은 예외.
    // 지원 마감일이 없으면 resolveAutoStatus가 null을 반환해 자동 전환이 아예 돌지 않고,
    // 평가 마감일이 없으면 평가 완료 시점을 판단할 수 없어 계속 ACTIVE(평가 진행)로 남는다.
    private void requirePublishDates(Instant applicationDeadline, Instant evaluationDeadline) {
        if (applicationDeadline == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Application deadline is required to publish a program.");
        }
        if (evaluationDeadline == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Evaluation deadline is required to publish a program.");
        }
    }

    private void validateProgramDates(
            Instant applicationStart,
            Instant applicationDeadline,
            Instant evaluationStart,
            Instant evaluationDeadline
    ) {
        if (applicationStart != null && applicationDeadline != null
                && !applicationStart.isBefore(applicationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Application start must be before its deadline.");
        }
        if (applicationDeadline != null && evaluationStart != null
                && evaluationStart.isBefore(applicationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Evaluation start must not be before the application deadline.");
        }
        if (evaluationStart != null && evaluationDeadline != null
                && !evaluationStart.isBefore(evaluationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Evaluation deadline must be after its start.");
        }
    }

    // 매니저가 프로그램 상태를 직접 바꾼다. 지정한 값을 그대로 반영한다.
    @Transactional
    public ProgramResponse changeStatus(Long programId, ChangeStatusRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        Status previous = program.getStatus();
        if (previous == Status.DRAFT && request.status() != Status.DRAFT) {
            requirePublishDates(ProgramTimes.applicationDeadline(program), ProgramTimes.evaluationDeadline(program));
        }
        program.changeStatus(request.status());
        // 임시 저장(DRAFT)에서 개설하는 경우에는 요청 값과 무관하게 오늘 날짜 기준으로 상태를 다시 잡는다.
        // (프론트가 개설 시 ACTIVE를 보내지만, 접수 시작 전이면 SCHEDULED여야 한다.)
        if (previous == Status.DRAFT && request.status() != Status.DRAFT) {
            applyAutoStatus(program);
        }
        return ProgramResponse.from(program);
    }

    // Module A 개인 참가자는 participantType=INDIVIDUAL인 1인 팀으로 저장한다.
    @Transactional
    public TeamResponse createTeam(Long programId, CreateTeamRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        ParticipantType participantType = request.participantType() == null
                ? ParticipantType.TEAM
                : request.participantType();

        Team team = teamRepository.save(new Team(
                program,
                request.name(),
                participantType,
                request.description(),
                request.name(),
                request.submissionUrl(),
                request.notes()
        ));
        if (request.memberIds() != null) {
            for (Long memberId : request.memberIds()) {
                User member = userRepository.findById(memberId)
                        .orElseThrow(() -> notFound("Member not found: " + memberId));
                teamMemberRepository.save(new TeamMember(team, member));
            }
        }

        return teamResponse(team);
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> findTeams(Long programId) {
        Set<Long> draftTeamIds = draftTeamIds(programId);
        return teamRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .filter(team -> !draftTeamIds.contains(team.getId()))
                .map(this::teamResponse)
                .toList();
    }

    // 아직 제출되지 않은(초안) 지원서에 연결된 팀 ID. 매니저 화면에는 제출한 지원 팀만 노출한다.
    private Set<Long> draftTeamIds(Long programId) {
        return applicationRepository.findByProgramIdAndStatus(programId, ApplicationStatus.DRAFT).stream()
                .map(Application::getTeam)
                .filter(Objects::nonNull)
                .map(Team::getId)
                .collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public TeamResponse findTeam(Long programId, Long teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        if (!team.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this program.");
        }
        return teamResponse(team);
    }

    @Transactional
    public TeamResponse updateTeam(Long programId, Long teamId, UpdateTeamRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        if (!team.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this program.");
        }

        team.update(request.name(), request.description(), request.name(), request.submissionUrl(), request.notes());
        return teamResponse(team);
    }

    @Transactional
    public TeamResponse changeTeamStatus(Long programId, Long teamId, ChangeTeamStatusRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        if (!team.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this program.");
        }

        team.changeStatus(request.status());
        return teamResponse(team);
    }

    // One transaction validates every item before replacing a team's score values.
    @Transactional
    public TeamResponse updateTeamBonus(Long programId, Long teamId, UpdateTeamBonusRequest request) {
        Program program = programRepository.findById(programId).orElseThrow(() -> notFound("Program not found."));
        entityManager.refresh(program, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        Team team = teamRepository.findById(teamId).orElseThrow(() -> notFound("Team not found."));
        if (!team.getProgram().getId().equals(programId)) throw badBonus("다른 프로그램의 팀입니다.");
        if (!program.isBonusEnabled()) throw badBonus("가산점을 사용하지 않는 프로그램입니다.");
        if (request.scores() == null) throw badBonus("가산점 항목별 점수가 필요합니다.");
        Map<Long, BonusItem> items = program.getBonusItems().stream()
                .collect(Collectors.toMap(BonusItem::getId, item -> item));
        Set<Long> seen = new HashSet<>();
        for (UpdateTeamBonusRequest.Item value : request.scores()) {
            if (value == null || value.itemId() == null || !items.containsKey(value.itemId()) || !seen.add(value.itemId())) {
                throw badBonus("가산점 항목이 잘못되었거나 중복되었습니다.");
            }
            validateBonusNumber(value.score(), true);
            BigDecimal max = items.get(value.itemId()).getMaxScore();
            if (value.score() != null && max != null && value.score().compareTo(max) > 0) {
                throw badBonus("가산점은 항목별 최대 점수를 초과할 수 없습니다.");
            }
        }
        if (!seen.equals(items.keySet())) throw badBonus("모든 가산점 항목을 포함해야 합니다. 미심사는 null로 전송하세요.");
        for (UpdateTeamBonusRequest.Item value : request.scores()) {
            TeamBonusScore score = team.getBonusScores().stream()
                    .filter(v -> v.getBonusItem().getId().equals(value.itemId())).findFirst().orElse(null);
            if (score == null) team.getBonusScores().add(new TeamBonusScore(team, items.get(value.itemId()), value.score()));
            else score.update(value.score());
        }
        entityManager.flush();
        return teamResponse(team);
    }

    private void updateBonusItems(Program program, Boolean enabled, BigDecimal legacyMax, List<BonusItemRequest> requested) {
        boolean nextEnabled = enabled == null ? program.isBonusEnabled() : enabled;
        if (program.isEvaluationStarted() && program.isBonusEnabled() && !nextEnabled) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "심사가 시작되어 가산점 사용을 해제할 수 없습니다.");
        }
        // Old clients may omit the item array when updating unrelated program fields.
        if (requested == null) {
            if (nextEnabled && program.getBonusItems().isEmpty()) {
                validateBonusNumber(legacyMax, true);
                program.getBonusItems().add(new BonusItem(program, "가산점", legacyMax, 1));
            }
        } else {
            if (nextEnabled && requested.isEmpty()) throw badBonus("가산점 항목을 최소 1개 등록하세요.");
            Map<Long, BonusItem> existing = program.getBonusItems().stream()
                    .collect(Collectors.toMap(BonusItem::getId, item -> item));
            Set<Long> kept = new HashSet<>();
            for (BonusItemRequest item : requested) {
                if (item == null || item.name() == null || item.name().isBlank() || item.name().trim().length() > 255) {
                    throw badBonus("가산점 항목명을 1~255자로 입력하세요.");
                }
                BonusItem old = item.id() == null ? null : existing.get(item.id());
                if (item.id() != null && (old == null || !kept.add(item.id()))) throw badBonus("잘못되거나 중복된 가산점 항목입니다.");
                // Only migrated unbounded items may retain their null limit.
                validateBonusNumber(item.maxScore(), old != null && old.getMaxScore() == null);
                boolean reduced = old != null && item.maxScore() != null
                        && (old.getMaxScore() == null || item.maxScore().compareTo(old.getMaxScore()) < 0);
                if (reduced && program.isEvaluationStarted()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "심사가 시작되어 최대 가산점을 줄일 수 없습니다.");
                }
                if (reduced) {
                    Long over = entityManager.createQuery("select count(s) from TeamBonusScore s where s.bonusItem.id = :id and s.score > :max", Long.class)
                            .setParameter("id", item.id()).setParameter("max", item.maxScore()).getSingleResult();
                    if (over > 0) throw badBonus("이미 부여한 가산점보다 최대 점수를 낮출 수 없습니다. 팀별 점수를 먼저 조정하세요.");
                }
            }
            if (program.isEvaluationStarted() && !kept.containsAll(existing.keySet())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "심사가 시작되어 가산점 항목을 삭제할 수 없습니다.");
            }
            Set<Long> removed = new HashSet<>(existing.keySet());
            removed.removeAll(kept);
            if (!removed.isEmpty()) {
                // Remove managed score references before deleting their item; DB cascade alone leaves stale JPA objects.
                for (Team team : teamRepository.findByProgramIdOrderByIdAsc(program.getId())) {
                    team.getBonusScores().removeIf(score -> removed.contains(score.getBonusItem().getId()));
                }
                entityManager.flush();
            }
            program.getBonusItems().removeIf(item -> !kept.contains(item.getId()));
            for (int i = 0; i < requested.size(); i++) {
                BonusItemRequest item = requested.get(i);
                if (item.id() == null) program.getBonusItems().add(new BonusItem(program, item.name().trim(), item.maxScore(), i + 1));
                else existing.get(item.id()).update(item.name().trim(), item.maxScore(), i + 1);
            }
            program.getBonusItems().sort(java.util.Comparator.comparingInt(BonusItem::getDisplayOrder));
        }
        BigDecimal max = program.getBonusItems().stream().anyMatch(item -> item.getMaxScore() == null) ? null
                : program.getBonusItems().stream().map(BonusItem::getMaxScore).reduce(BigDecimal.ZERO, BigDecimal::add);
        program.updateBonusSettings(nextEnabled, max);
    }

    private void validateBonusNumber(BigDecimal value, boolean nullable) {
        if (value == null) {
            if (!nullable) throw badBonus("최대 점수를 입력하세요.");
            return;
        }
        if (value.signum() < 0 || value.stripTrailingZeros().scale() > 2 || value.compareTo(new BigDecimal("99999999.99")) > 0) {
            throw badBonus("점수는 0 이상 99999999.99 이하, 소수 둘째 자리까지 입력하세요.");
        }
    }

    private ResponseStatusException badBonus(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private TeamResponse teamResponse(Team team) {
        return TeamResponse.from(
                team,
                membersOf(team.getId()),
                attachmentRepository.countByTeamId(team.getId())
        );
    }

    private List<TeamMemberResponse> membersOf(Long teamId) {
        return teamMemberRepository.findByTeamIdOrderByIdAsc(teamId).stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    // 팀에 소속된 팀원 목록을 조회한다.
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> findTeamMembers(Long teamId) {
        return teamMemberRepository.findByTeamIdOrderByIdAsc(teamId).stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    @Transactional
    public TeamMemberResponse addTeamMember(Long teamId, AddTeamMemberRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        User member = userRepository.findByEmail(request.email())
                .orElseThrow(() -> notFound("Member not found."));

        teamMemberRepository.findByTeamIdAndMemberId(teamId, member.getId()).ifPresent(m -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Member already in team.");
        });

        return TeamMemberResponse.from(teamMemberRepository.save(new TeamMember(team, member)));
    }

    @Transactional
    public void removeTeamMember(Long teamId, Long memberId) {
        TeamMember teamMember = teamMemberRepository.findByTeamIdAndMemberId(teamId, memberId)
                .orElseThrow(() -> notFound("Member not found in team."));
        teamMemberRepository.delete(teamMember);
    }

    // 항목별 배점을 실제 점수 상한으로 사용한다.
    @Transactional
    public CriterionResponse createCriterion(Long programId, CreateCriterionRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        lockCriteriaProgram(program);
        if (program.isEvaluationStarted()) throw criteriaLocked();
        validateCriterionMaxScore(request.maxScore());
        EvaluationCriterion criterion = new EvaluationCriterion(
                program,
                request.name(),
                request.description(),
                BigDecimal.ONE,
                request.displayOrder()
        );
        criterion.updateMaxScore(request.maxScore());
        return CriterionResponse.from(criterionRepository.save(criterion));
    }

    // 질문은 displayOrder 기준으로 정렬해 평가 화면에 표시한다.
    @Transactional(readOnly = true)
    public List<CriterionResponse> findCriteria(Long programId) {
        return criterionRepository.findByProgramIdOrderByDisplayOrderAsc(programId).stream()
                .map(CriterionResponse::from)
                .toList();
    }

    // 평가 질문을 수정한다.
    @Transactional
    public CriterionResponse updateCriterion(Long programId, Long criterionId, UpdateCriterionRequest request) {
        EvaluationCriterion criterion = criterionRepository.findById(criterionId)
                .orElseThrow(() -> notFound("Criterion not found."));
        if (!criterion.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Criterion does not belong to this program.");
        }

        lockCriteriaProgram(criterion.getProgram());
        validateCriterionMaxScore(request.maxScore());
        if (criterion.getProgram().isEvaluationStarted()
                && (request.maxScore().compareTo(criterion.getMaxScore()) != 0
                || !java.util.Objects.equals(request.displayOrder(), criterion.getDisplayOrder()))) throw criteriaLocked();
        criterion.update(request.name(), request.description(), criterion.getWeight(), request.displayOrder());
        criterion.updateMaxScore(request.maxScore());
        return CriterionResponse.from(criterion);
    }

    // 평가 질문을 삭제한다. 이미 채점된 점수가 있으면 같이 삭제되니 주의.
    @Transactional
    public void deleteCriterion(Long programId, Long criterionId) {
        EvaluationCriterion criterion = criterionRepository.findById(criterionId)
                .orElseThrow(() -> notFound("Criterion not found."));
        if (!criterion.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Criterion does not belong to this program.");
        }
        lockCriteriaProgram(criterion.getProgram());
        if (criterion.getProgram().isEvaluationStarted()) throw criteriaLocked();
        criterionRepository.delete(criterion);
    }

    private void lockCriteriaProgram(Program program) {
        entityManager.flush();
        entityManager.refresh(program, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
    }

    private ResponseStatusException criteriaLocked() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "심사가 시작된 프로그램의 배점과 항목 구성은 변경할 수 없습니다.");
    }

    private void validateCriterionMaxScore(BigDecimal maxScore) {
        if (maxScore == null || maxScore.signum() <= 0 || maxScore.compareTo(new BigDecimal("999999.99")) > 0
                || maxScore.stripTrailingZeros().scale() > 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "배점은 0보다 크고 999999.99 이하인 소수 둘째 자리까지의 숫자여야 합니다.");
        }
    }

    // 프로그램의 지원 양식 항목을 순서대로 조회한다.
    @Transactional(readOnly = true)
    public List<FormFieldResponse> findFormFields(Long programId) {
        return formFieldRepository.findByProgramIdOrderByDisplayOrderAsc(programId).stream()
                .map(FormFieldResponse::from)
                .toList();
    }

    // 지원 양식 항목을 저장한다. 화면 순서를 displayOrder로 저장한다.
    //
    // 항목을 통째로 지우고 다시 만들면 application_answers의 on delete cascade 때문에
    // 지원자가 이미 제출한 답변이 함께 사라진다. 따라서 id를 기준으로 차이만 반영한다.
    //   - id가 있는 항목: 기존 행을 제자리에서 수정한다 (id 유지 → 답변 보존)
    //   - id가 null인 항목: 새로 추가한다
    //   - 요청에 없는 기존 항목: 삭제한다. 단 답변이 달려 있으면 409로 막는다
    @Transactional
    public List<FormFieldResponse> replaceFormFields(Long programId, ReplaceFormFieldsRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        Map<Long, ApplicationFormField> existing = new LinkedHashMap<>();
        for (ApplicationFormField field : formFieldRepository.findByProgramIdOrderByDisplayOrderAsc(programId)) {
            existing.put(field.getId(), field);
        }

        List<ReplaceFormFieldsRequest.Item> items = request.fields() == null ? List.of() : request.fields();

        // 남겨둘 항목을 먼저 가려낸다. 나머지가 삭제 대상이다.
        Set<Long> keptIds = new HashSet<>();
        for (ReplaceFormFieldsRequest.Item item : items) {
            if (item.id() == null) continue;
            if (!existing.containsKey(item.id())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Form field " + item.id() + " does not belong to this program.");
            }
            if (!keptIds.add(item.id())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Duplicate form field id in request: " + item.id());
            }
        }

        List<ApplicationFormField> toDelete = existing.values().stream()
                .filter(field -> !keptIds.contains(field.getId()))
                .toList();

        guardAnsweredFieldsNotDeleted(toDelete);

        // 화면 순서(i + 1)를 displayOrder로 다시 매긴다.
        List<ApplicationFormField> toSave = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            ReplaceFormFieldsRequest.Item item = items.get(i);
            String options = joinOptions(item.options());
            if (item.id() == null) {
                toSave.add(new ApplicationFormField(
                        program, item.label(), item.fieldType(), item.required(), i + 1, options
                ));
            } else {
                ApplicationFormField field = existing.get(item.id());
                field.update(item.label(), item.fieldType(), item.required(), i + 1, options);
                toSave.add(field);
            }
        }

        if (!toDelete.isEmpty()) {
            formFieldRepository.deleteAll(toDelete);
        }
        formFieldRepository.saveAll(toSave);

        return findFormFields(programId);
    }

    // 답변이 달린 양식 항목은 삭제를 막는다. 지우면 그 항목의 모든 지원자 답변이 cascade로 사라진다.
    private void guardAnsweredFieldsNotDeleted(List<ApplicationFormField> toDelete) {
        if (toDelete.isEmpty()) return;

        Set<Long> answered = Set.copyOf(answerRepository.findAnsweredFieldIds(
                toDelete.stream().map(ApplicationFormField::getId).toList()
        ));
        if (answered.isEmpty()) return;

        String labels = toDelete.stream()
                .filter(field -> answered.contains(field.getId()))
                .map(ApplicationFormField::getLabel)
                .collect(Collectors.joining(", "));
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "이미 지원자가 답변한 항목은 삭제할 수 없습니다: " + labels);
    }

    // 선택지 목록을 줄바꿈으로 이어붙여 저장한다. 빈 값은 제외하고, 남는 게 없으면 null.
    private String joinOptions(List<String> options) {
        if (options == null) return null;
        String joined = options.stream()
                .map(s -> s == null ? "" : s.trim())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining("\n"));
        return joined.isEmpty() ? null : joined;
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> notFound("User not found."));
        userRepository.delete(user);
    }

    @Transactional
    public void deleteProgram(Long programId) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));
        programRepository.delete(program);
    }

    @Transactional
    public void deleteTeam(Long programId, Long teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        if (!team.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this program.");
        }
        teamRepository.delete(team);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (request.role() == Role.EVALUATOR) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "심사위원은 POST /api/evaluators로 생성해주세요.");
        }
        if (request.email() == null || request.email().isBlank()
                || request.password() == null || request.password().isBlank()
                || request.role() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email, password and role are required.");
        }
        String email = request.email().trim().toLowerCase();
        userRepository.findByEmailIgnoreCase(email).ifPresent(user -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
        });

        User user = new User(
                email,
                passwordEncoder.encode(request.password()),
                request.role(),
                request.name(),
                request.department()
        );
        return UserResponse.from(userRepository.save(user));
    }

    // 이메일로 사용자를 조회한다. 팀원 추가 화면에서 실제 존재하는 사용자인지 확인하는 데 사용한다.
    @Transactional(readOnly = true)
    public UserResponse findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(UserResponse::from)
                .orElseThrow(() -> notFound("User not found."));
    }

    // 최고 관리자 화면에서 매니저 계정 목록을 조회한다.
    // UserResponse.assignmentCount 자리에 해당 매니저가 담당 중인 프로그램 수를 담아 반환한다.
    @Transactional(readOnly = true)
    public List<UserResponse> findManagers() {
        return userRepository.findByRole(Role.MANAGER).stream()
                .map(u -> UserResponse.from(u, programRepository.countByManagerId(u.getId())))
                .toList();
    }

    // 평가 배정 화면에서 선택 가능한 심사위원 목록을 제공한다.
    @Transactional(readOnly = true)
    public List<UserResponse> findEvaluators() {
        return userRepository.findByRole(Role.EVALUATOR).stream()
                .map(u -> UserResponse.from(u, assignmentRepository.countByEvaluatorId(u.getId())))
                .toList();
    }

    // 특정 프로그램에 배정된 심사위원 목록을 조회한다.
    @Transactional(readOnly = true)
    public List<UserResponse> findEvaluatorsByProgram(Long programId) {
        return assignmentRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(assignment -> UserResponse.from(assignment.getEvaluator()))
                .toList();
    }

    // 한 프로그램에 한 심사위원의 중복 배정을 막는다.
    @Transactional
    public AssignmentResponse createAssignment(Long programId, CreateAssignmentRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));
        User evaluator = userRepository.findById(request.evaluatorId())
                .orElseThrow(() -> notFound("Evaluator not found."));

        if (evaluator.getRole() != Role.EVALUATOR) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not an evaluator.");
        }
        assignmentRepository.findByProgramIdAndEvaluatorId(programId, evaluator.getId()).ifPresent(assignment -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Assignment already exists.");
        });

        EvaluationAssignment assignment = assignmentRepository.save(new EvaluationAssignment(program, evaluator));

        // 배정이 늘어도 프로그램 상태는 건드리지 않는다.
        // 완료된 프로그램을 다시 열려면 매니저가 평가 마감일을 연장해야 한다. (updateProgram)
        return AssignmentResponse.from(assignment);
    }

    // 심사위원 계정 비활성화/활성화.
    @Transactional
    public UserResponse changeEvaluatorStatus(Long evaluatorId, ChangeStatusRequest request) {
        User evaluator = userRepository.findById(evaluatorId)
                .orElseThrow(() -> notFound("Evaluator not found."));
        evaluator.changeStatus(request.status());
        return UserResponse.from(evaluator);
    }

    // 심사위원 대시보드에서 자신의 평가 작업 목록을 확인할 때 사용한다.
    @Transactional(readOnly = true)
    public List<AssignmentResponse> findAssignmentsByEvaluator(Long evaluatorId) {
        return assignmentRepository.findByEvaluatorIdOrderByIdDesc(evaluatorId).stream()
                .map(AssignmentResponse::from)
                .toList();
    }

    // 프로그램에 속한 전체 배정 목록을 조회한다. 배정 매트릭스에서 사용.
    @Transactional(readOnly = true)
    public List<AssignmentResponse> findAssignmentsByProgram(Long programId) {
        return assignmentRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(AssignmentResponse::from)
                .toList();
    }

    // 배정을 취소(삭제)한다.
    @Transactional
    public void cancelAssignment(Long assignmentId) {
        EvaluationAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> notFound("Assignment not found."));

        if (assignment.getStatus() == AssignmentStatus.SUBMITTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot cancel a submitted assignment.");
        }

        assignmentRepository.delete(assignment);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
