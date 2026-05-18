package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ProgramManagementService {

    private final ProgramRepository programRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProgramParticipantRepository participantRepository;
    private final EvaluationCriterionRepository criterionRepository;
    private final EvaluationAssignmentRepository assignmentRepository;

    public ProgramManagementService(
            ProgramRepository programRepository,
            UserRepository userRepository,
            TeamRepository teamRepository,
            TeamMemberRepository teamMemberRepository,
            ProgramParticipantRepository participantRepository,
            EvaluationCriterionRepository criterionRepository,
            EvaluationAssignmentRepository assignmentRepository
    ) {
        this.programRepository = programRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.participantRepository = participantRepository;
        this.criterionRepository = criterionRepository;
        this.assignmentRepository = assignmentRepository;
    }

    // 프로그램 생성의 기준 데이터만 저장한다. 팀, 질문, 배정은 별도 API에서 단계적으로 등록한다.
    @Transactional
    public ProgramResponse createProgram(CreateProgramRequest request) {
        User manager = request.managerId() == null ? null : userRepository.findById(request.managerId())
                .orElseThrow(() -> notFound("Manager not found."));

        Program program = new Program(manager, request.title(), request.description(), request.type());
        return ProgramResponse.from(programRepository.save(program));
    }

    // 현재는 전체 프로그램을 반환한다. 인증 도입 후에는 manager 권한에 맞춰 필터링한다.
    @Transactional(readOnly = true)
    public List<ProgramResponse> findPrograms() {
        return programRepository.findAll().stream()
                .map(ProgramResponse::from)
                .toList();
    }

    // 팀을 만들면서 동시에 평가 대상(program_participant)도 생성한다.
    // Module A 개인 참가자는 participantType=INDIVIDUAL인 1인 팀으로 저장한다.
    @Transactional
    public TeamResponse createTeam(Long programId, CreateTeamRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));

        ParticipantType participantType = request.participantType() == null
                ? ParticipantType.TEAM
                : request.participantType();

        Team team = teamRepository.save(new Team(program, request.name(), participantType, request.description()));
        if (request.memberIds() != null) {
            for (Long memberId : request.memberIds()) {
                User member = userRepository.findById(memberId)
                        .orElseThrow(() -> notFound("Member not found: " + memberId));
                teamMemberRepository.save(new TeamMember(team, member));
            }
        }

        ProgramParticipant participant = participantRepository.save(new ProgramParticipant(
                program,
                team,
                request.name(),
                request.submissionUrl(),
                request.notes()
        ));

        return TeamResponse.from(team, participant);
    }

    // 프로그램에 속한 팀을 평가 대상 id와 함께 반환한다.
    @Transactional(readOnly = true)
    public List<TeamResponse> findTeams(Long programId) {
        return teamRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(team -> TeamResponse.from(team, participantRepository.findByTeamId(team.getId())
                        .orElseThrow(() -> notFound("Participant not found for team."))))
                .toList();
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

    // 개발 초기용 심사위원 생성 로직이다. 운영 전에는 비밀번호 암호화와 초대 플로우가 필요하다.
    @Transactional
    public UserResponse createEvaluator(CreateEvaluatorRequest request) {
        userRepository.findByEmail(request.email()).ifPresent(user -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
        });

        User evaluator = new User(request.email(), request.password(), Role.EVALUATOR);
        return UserResponse.from(userRepository.save(evaluator));
    }

    // 평가 배정 화면에서 선택 가능한 심사위원 목록을 제공한다.
    @Transactional(readOnly = true)
    public List<UserResponse> findEvaluators() {
        return userRepository.findByRole(Role.EVALUATOR).stream()
                .map(UserResponse::from)
                .toList();
    }

    // 한 평가 대상과 한 심사위원의 중복 배정을 막고, 같은 프로그램 안에서만 배정한다.
    @Transactional
    public AssignmentResponse createAssignment(Long programId, CreateAssignmentRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));
        ProgramParticipant participant = participantRepository.findById(request.participantId())
                .orElseThrow(() -> notFound("Participant not found."));
        User evaluator = userRepository.findById(request.evaluatorId())
                .orElseThrow(() -> notFound("Evaluator not found."));

        if (evaluator.getRole() != Role.EVALUATOR && evaluator.getRole() != Role.RESTRICTED_EVALUATOR) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not an evaluator.");
        }
        if (!participant.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Participant does not belong to this program.");
        }
        assignmentRepository.findByParticipantIdAndEvaluatorId(participant.getId(), evaluator.getId()).ifPresent(assignment -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Assignment already exists.");
        });

        return AssignmentResponse.from(assignmentRepository.save(new EvaluationAssignment(program, participant, evaluator)));
    }

    // 심사위원 대시보드에서 자신의 평가 작업 목록을 확인할 때 사용한다.
    @Transactional(readOnly = true)
    public List<AssignmentResponse> findAssignmentsByEvaluator(Long evaluatorId) {
        return assignmentRepository.findByEvaluatorIdOrderByIdDesc(evaluatorId).stream()
                .map(AssignmentResponse::from)
                .toList();
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
