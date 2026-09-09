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
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProgramManagementService {

    private final ProgramRepository programRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final EvaluationCriterionRepository criterionRepository;
    private final EvaluationAssignmentRepository assignmentRepository;
    private final ApplicationFormFieldRepository formFieldRepository;
    private final ApplicationRepository applicationRepository;
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
        this.attachmentRepository = attachmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 프로그램 생성의 기준 데이터만 저장한다. 팀, 질문, 배정은 별도 API에서 단계적으로 등록한다.
    @Transactional
    public ProgramResponse createProgram(CreateProgramRequest request) {
        User manager = request.managerId() == null ? null : userRepository.findById(request.managerId())
                .orElseThrow(() -> notFound("Manager not found."));
        validateProgramDates(request.applicationStart(), request.applicationDeadline(), request.evaluationStart(), request.evaluationDeadline());

        Program program = new Program(manager, request.title(), request.description(), request.type(), request.applicationStart(), request.applicationDeadline(), request.evaluationStart(), request.evaluationDeadline(), request.eligibilityCriteria());
        if (request.status() != null) {
            program.changeStatus(request.status());
        }
        program.updateAttachmentSettings(request.attachmentsEnabled(), request.maxAttachments());
        program.updateParticipantType(request.participantType());
        program.updateBonusSettings(request.bonusEnabled(), request.maxBonus());
        Program saved = programRepository.save(program);
        applyAutoStatus(saved); // 지원 기간이 지정되어 있으면 접수중/평가중으로 즉시 반영
        return ProgramResponse.from(saved);
    }

    // 지원자에게 노출할 프로그램 목록: 접수 중(RECRUITING) + 접수 예정(SCHEDULED).
    // 실제 지원 가능 여부는 상태로 구분하며, 지원 시작 전(SCHEDULED)에는 프론트에서 '접수 예정'으로 표시한다.
    @Transactional(readOnly = true)
    public List<ProgramResponse> findOpenPrograms() {
        return programRepository
                .findByStatusInOrderByApplicationDeadlineAsc(List.of(Status.RECRUITING, Status.SCHEDULED)).stream()
                .map(ProgramResponse::from)
                .toList();
    }

    // 지원 기간(마감일)에 맞춰 전체 프로그램 상태를 동기화한다. 스케줄러가 주기적으로 호출한다.
    @Transactional
    public int syncProgramStatuses() {
        int changed = 0;
        for (Program program : programRepository.findAll()) {
            if (applyAutoStatus(program)) changed++;
        }
        return changed;
    }

    // 자동 전환 규칙에 따른 목표 상태를 계산한다.
    // - 대상: SCHEDULED / RECRUITING / ACTIVE (DRAFT·INACTIVE는 매니저 수동 관리라 건드리지 않음)
    // - 마감일이 없으면 기간을 알 수 없어 전환하지 않는다.
    // - 지원 시작일 전 → SCHEDULED(접수 예정)
    // - 시작일~마감일(당일 포함) → RECRUITING(접수중)
    // - 마감일 경과 → ACTIVE(평가중)
    private Status resolveAutoStatus(Program program) {
        Status current = program.getStatus();
        if (current != Status.SCHEDULED && current != Status.RECRUITING && current != Status.ACTIVE) return null;
        LocalDate deadline = program.getApplicationDeadline();
        if (deadline == null) return null;
        LocalDate today = LocalDate.now();
        LocalDate start = program.getApplicationStart();
        if (start != null && today.isBefore(start)) return Status.SCHEDULED;
        return today.isAfter(deadline) ? Status.ACTIVE : Status.RECRUITING;
    }

    // 단일 프로그램에 자동 상태 규칙을 적용한다. 실제로 바뀌면 true.
    private boolean applyAutoStatus(Program program) {
        Status target = resolveAutoStatus(program);
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

    // 프로그램 기본 정보(제목, 설명, 유형, 담당자)를 수정한다.
    @Transactional
    public ProgramResponse updateProgram(Long programId, UpdateProgramRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        User manager = request.managerId() == null ? null : userRepository.findById(request.managerId())
                .orElseThrow(() -> notFound("Manager not found."));

        LocalDate applicationStart = request.applicationStart() == null
                ? program.getApplicationStart() : request.applicationStart();
        LocalDate applicationDeadline = request.applicationDeadline() == null
                ? program.getApplicationDeadline() : request.applicationDeadline();
        LocalDate evaluationStart = request.evaluationStart() == null
                ? program.getEvaluationStart() : request.evaluationStart();
        LocalDate evaluationDeadline = request.evaluationDeadline() == null
                ? program.getEvaluationDeadline() : request.evaluationDeadline();
        validateProgramDates(applicationStart, applicationDeadline, evaluationStart, evaluationDeadline);

        program.update(request.title(), request.description(), request.type(), manager, request.applicationStart(), request.applicationDeadline(), request.evaluationStart(), request.evaluationDeadline(), request.eligibilityCriteria());
        program.updateAttachmentSettings(request.attachmentsEnabled(), request.maxAttachments());
        program.updateParticipantType(request.participantType());
        program.updateBonusSettings(request.bonusEnabled(), request.maxBonus());
        applyAutoStatus(program); // 마감일이 바뀌면 접수중/평가중을 즉시 재계산
        return ProgramResponse.from(program);
    }

    private void validateProgramDates(
            LocalDate applicationStart,
            LocalDate applicationDeadline,
            LocalDate evaluationStart,
            LocalDate evaluationDeadline
    ) {
        if (applicationStart != null && applicationDeadline != null
                && applicationStart.isAfter(applicationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Application start must not be after its deadline.");
        }
        if (applicationDeadline != null && evaluationStart != null
                && evaluationStart.isBefore(applicationDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Evaluation start must not be before the application deadline.");
        }
        if (evaluationStart != null && evaluationDeadline != null
                && evaluationDeadline.isBefore(evaluationStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Evaluation deadline must not be before its start.");
        }
    }

    // 프로그램 상태를 ACTIVE ↔ INACTIVE로 전환한다.
    @Transactional
    public ProgramResponse changeStatus(Long programId, ChangeStatusRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        program.changeStatus(request.status());
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

    // 매니저가 팀별 가산점과 사유를 입력한다. 프로그램에 가산점이 활성화되어 있어야 하며, 값은 0 이상·최대 가산점 이하여야 한다.
    @Transactional
    public TeamResponse updateTeamBonus(Long programId, Long teamId, UpdateTeamBonusRequest request) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> notFound("Team not found."));
        Program program = team.getProgram();
        if (!program.getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this program.");
        }
        if (!program.isBonusEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bonus is not enabled for this program.");
        }

        BigDecimal score = request.bonusScore();
        if (score != null) {
            if (score.signum() < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bonus score must be non-negative.");
            }
            BigDecimal max = program.getMaxBonus();
            if (max != null && score.compareTo(max) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bonus score exceeds the program maximum.");
            }
        }

        String reason = request.bonusReason() == null || request.bonusReason().isBlank()
                ? null : request.bonusReason().trim();
        team.updateBonus(score, reason);
        return teamResponse(team);
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

    // 하나의 질문은 0~10점 점수형 평가 항목이다. weight는 추후 가중 평균 계산에 사용할 수 있다.
    @Transactional
    public CriterionResponse createCriterion(Long programId, CreateCriterionRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        BigDecimal weight = request.weight() == null ? BigDecimal.ONE : request.weight();
        EvaluationCriterion criterion = new EvaluationCriterion(
                program,
                request.name(),
                request.description(),
                weight,
                request.displayOrder()
        );
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

        BigDecimal weight = request.weight() == null ? criterion.getWeight() : request.weight();
        criterion.update(request.name(), request.description(), weight, request.displayOrder());
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
        criterionRepository.delete(criterion);
    }

    // 프로그램의 지원 양식 항목을 순서대로 조회한다.
    @Transactional(readOnly = true)
    public List<FormFieldResponse> findFormFields(Long programId) {
        return formFieldRepository.findByProgramIdOrderByDisplayOrderAsc(programId).stream()
                .map(FormFieldResponse::from)
                .toList();
    }

    // 지원 양식 항목 전체를 교체한다. 화면 순서를 displayOrder로 저장한다.
    @Transactional
    public List<FormFieldResponse> replaceFormFields(Long programId, ReplaceFormFieldsRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        formFieldRepository.deleteByProgramId(programId);

        List<ReplaceFormFieldsRequest.Item> items = request.fields() == null ? List.of() : request.fields();
        for (int i = 0; i < items.size(); i++) {
            ReplaceFormFieldsRequest.Item item = items.get(i);
            formFieldRepository.save(new ApplicationFormField(
                    program,
                    item.label(),
                    item.fieldType(),
                    item.required(),
                    i + 1,
                    joinOptions(item.options())
            ));
        }
        return findFormFields(programId);
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

        // 완료 처리된 프로그램에 새 평가 작업이 생기면 실제 진행 상태에 맞게 다시 연다.
        if (program.getStatus() == Status.INACTIVE) {
            program.changeStatus(Status.ACTIVE);
        }

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
