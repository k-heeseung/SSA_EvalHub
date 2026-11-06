package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import com.example.evalhub.util.ProgramTimes;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EvaluationService {

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private final EvaluationAssignmentRepository assignmentRepository;
    private final EvaluationCriterionRepository criterionRepository;
    private final EvaluationSubmissionRepository submissionRepository;
    private final EvaluationScoreRepository scoreRepository;
    private final ParticipantAttachmentRepository attachmentRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationService applicationService;

    public EvaluationService(
            EvaluationAssignmentRepository assignmentRepository,
            EvaluationCriterionRepository criterionRepository,
            EvaluationSubmissionRepository submissionRepository,
            EvaluationScoreRepository scoreRepository,
            ParticipantAttachmentRepository attachmentRepository,
            TeamRepository teamRepository,
            TeamMemberRepository teamMemberRepository,
            ApplicationRepository applicationRepository,
            ApplicationService applicationService
    ) {
        this.assignmentRepository = assignmentRepository;
        this.criterionRepository = criterionRepository;
        this.submissionRepository = submissionRepository;
        this.scoreRepository = scoreRepository;
        this.attachmentRepository = attachmentRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.applicationRepository = applicationRepository;
        this.applicationService = applicationService;
    }

    // 평가 화면 초기 데이터: 프로그램, 평가 대상, 질문, PDF, 기존 제출 내용을 조립한다.
    @Transactional(readOnly = true)
    public EvaluationViewResponse getEvaluationView(Long assignmentId, Long teamId, Long evaluatorId) {
        EvaluationAssignment assignment = findOwnedAssignment(assignmentId, evaluatorId);
        Team team = findTeam(teamId);
        validateTeamBelongsToProgram(team, assignment.getProgram().getId());
        validateTeamIsEvaluable(team);

        List<CriterionResponse> criteria = criterionRepository
                .findByProgramIdOrderByDisplayOrderAsc(assignment.getProgram().getId())
                .stream()
                .map(CriterionResponse::from)
                .toList();

        List<ParticipantAttachmentResponse> attachments = attachmentRepository
                .findByTeamIdOrderByUploadedAtDesc(team.getId())
                .stream()
                .map(ParticipantAttachmentResponse::from)
                .toList();

        EvaluationSubmissionResponse submission = submissionRepository.findByAssignmentIdAndTeamId(assignmentId, teamId)
                .map(this::toSubmissionResponse)
                .orElse(null);

        List<TeamMemberResponse> members = teamMemberRepository.findByTeamIdOrderByIdAsc(team.getId()).stream()
                .map(TeamMemberResponse::from)
                .toList();

        return new EvaluationViewResponse(
                ProgramResponse.from(assignment.getProgram()),
                TeamResponse.from(team, members),
                applicationService.findApplicationByTeam(team.getId()),
                criteria,
                attachments,
                submission
        );
    }

    // 평가자 팀 목록: 배정된 프로그램의 모든 팀과, 각 팀에 대한 본인 채점 상태를 함께 조회한다.
    @Transactional(readOnly = true)
    public List<EvaluationTeamStatusResponse> getAssignmentTeams(Long assignmentId, Long evaluatorId) {
        EvaluationAssignment assignment = findOwnedAssignment(assignmentId, evaluatorId);
        List<Team> teams = findEvaluableTeams(assignment.getProgram().getId());
        BigDecimal maxTotalScore = criterionRepository
                .findByProgramIdOrderByDisplayOrderAsc(assignment.getProgram().getId()).stream()
                .map(EvaluationCriterion::getMaxScore)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<Long, EvaluationSubmission> submissionByTeam = submissionRepository.findByAssignmentId(assignmentId).stream()
                .collect(Collectors.toMap(s -> s.getTeam().getId(), Function.identity()));

        return teams.stream()
                .map(team -> {
                    EvaluationSubmission submission = submissionByTeam.get(team.getId());
                    EvaluationSubmissionResponse submissionResponse = submission == null
                            ? null
                            : toSubmissionResponse(submission);
                    return new EvaluationTeamStatusResponse(
                            team.getId(),
                            team.getName(),
                            team.getDescription(),
                            totalMemberCount(team),
                            submissionResponse == null ? null : submissionResponse.status(),
                            submissionResponse == null ? null : submissionResponse.totalScore(),
                            maxTotalScore,
                            submissionResponse == null ? null : submissionResponse.oneLineComment(),
                            BonusScoreResponse.from(team)
                    );
                })
                .toList();
    }

    // 계정 연결 여부와 관계없이 지원서에 입력된 팀장 1명과 추가 팀원 전원을 센다.
    private int totalMemberCount(Team team) {
        return ApplicantInfo.parse(team.getApplicantInfo()).totalMemberCount();
    }

    // 평가자 대시보드: 배정(프로그램)별로 팀 수와 제출/임시저장 수를 집계해 진행 현황을 조회한다.
    @Transactional(readOnly = true)
    public List<EvaluatorAssignmentResponse> getEvaluatorAssignments(Long evaluatorId) {
        List<EvaluationAssignment> assignments = assignmentRepository.findByEvaluatorIdOrderByIdDesc(evaluatorId);
        if (assignments.isEmpty()) {
            return List.of();
        }

        List<Long> assignmentIds = assignments.stream().map(EvaluationAssignment::getId).toList();
        Map<Long, List<EvaluationSubmission>> submissionsByAssignment = submissionRepository
                .findByAssignmentIdIn(assignmentIds).stream()
                .collect(Collectors.groupingBy(s -> s.getAssignment().getId()));

        return assignments.stream()
                .map(assignment -> {
                    Set<Long> evaluableTeamIds = findEvaluableTeams(assignment.getProgram().getId()).stream()
                            .map(Team::getId)
                            .collect(Collectors.toSet());
                    int teamCount = evaluableTeamIds.size();
                    List<EvaluationSubmission> submissions = submissionsByAssignment
                            .getOrDefault(assignment.getId(), List.of()).stream()
                            .filter(submission -> evaluableTeamIds.contains(submission.getTeam().getId()))
                            .toList();
                    int submittedCount = (int) submissions.stream()
                            .filter(s -> s.getStatus() == SubmissionStatus.SUBMITTED).count();
                    int draftCount = (int) submissions.stream()
                            .filter(s -> s.getStatus() == SubmissionStatus.DRAFT).count();
                    AssignmentStatus status = teamCount > 0 && submittedCount == teamCount
                            ? AssignmentStatus.SUBMITTED
                            : (submittedCount + draftCount > 0 ? AssignmentStatus.IN_PROGRESS : AssignmentStatus.ASSIGNED);
                    return new EvaluatorAssignmentResponse(
                            assignment.getId(),
                            assignment.getProgram().getId(),
                            assignment.getProgram().getTitle(),
                            assignment.getProgram().getEvaluationStart(),
                            assignment.getProgram().getEvaluationDeadline(),
                            status,
                            teamCount,
                            submittedCount,
                            draftCount,
                            ProgramScheduleResponse.from(assignment.getProgram())
                    );
                })
                .toList();
    }

    // 작성 중인 평가는 일부 질문만 점수가 있어도 저장할 수 있다.
    @Transactional
    public EvaluationSubmissionResponse saveDraft(
            Long assignmentId,
            Long teamId,
            Long evaluatorId,
            SaveEvaluationRequest request
    ) {
        return save(assignmentId, teamId, evaluatorId, request, false);
    }

    // 최종 제출은 모든 질문에 항목 배점 이내의 점수가 있어야 가능하다.
    @Transactional
    public EvaluationSubmissionResponse submit(
            Long assignmentId,
            Long teamId,
            Long evaluatorId,
            SaveEvaluationRequest request
    ) {
        return save(assignmentId, teamId, evaluatorId, request, true);
    }

    // 임시저장과 제출이 공유하는 저장 로직이다.
    private EvaluationSubmissionResponse save(
            Long assignmentId,
            Long teamId,
            Long evaluatorId,
            SaveEvaluationRequest request,
            boolean submit
    ) {
        EvaluationAssignment assignment = findOwnedAssignment(assignmentId, evaluatorId);
        // Preserve changes made earlier in this transaction before reloading under the program lock.
        entityManager.flush();
        entityManager.refresh(assignment.getProgram(), jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        Team team = findTeam(teamId);
        validateTeamBelongsToProgram(team, assignment.getProgram().getId());
        validateTeamIsEvaluable(team);
        validateEvaluationStarted(assignment);
        validateEvaluationNotClosed(assignment);
        validateOneLineComment(request.oneLineComment());

        List<EvaluationCriterion> criteria = criterionRepository
                .findByProgramIdOrderByDisplayOrderAsc(assignment.getProgram().getId());
        Map<Long, EvaluationCriterion> criteriaById = criteria.stream()
                .collect(Collectors.toMap(EvaluationCriterion::getId, Function.identity()));

        List<EvaluationScoreRequest> requestedScores = request.scores() == null ? List.of() : request.scores();
        validateScores(requestedScores, criteriaById, submit);

        EvaluationSubmission submission = submissionRepository.findByAssignmentIdAndTeamId(assignmentId, teamId)
                .orElseGet(() -> submissionRepository.save(new EvaluationSubmission(assignment, team)));

        // 요청은 현재 화면의 전체 점수 상태다. 비워서 요청에서 빠진 점수는 삭제한다.
        Set<Long> requestedCriterionIds = requestedScores.stream()
                .map(EvaluationScoreRequest::criterionId)
                .collect(Collectors.toSet());
        List<EvaluationScore> removedScores = scoreRepository.findBySubmissionId(submission.getId()).stream()
                .filter(score -> !requestedCriterionIds.contains(score.getCriterion().getId()))
                .toList();
        scoreRepository.deleteAll(removedScores);

        for (EvaluationScoreRequest requestedScore : requestedScores) {
            EvaluationCriterion criterion = criteriaById.get(requestedScore.criterionId());
            EvaluationScore score = scoreRepository.findBySubmissionIdAndCriterionId(
                            submission.getId(),
                            criterion.getId()
                    )
                    .orElseGet(() -> new EvaluationScore(submission, criterion, requestedScore.score()));
            score.updateScore(requestedScore.score());
            scoreRepository.save(score);
        }

        List<EvaluationScore> savedScores = scoreRepository.findBySubmissionId(submission.getId());
        BigDecimal totalScore = calculateTotalScore(savedScores);

        if (submit) {
            if (savedScores.size() != criteria.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All criteria must be scored before submission.");
            }
            submission.submit(totalScore, request.oneLineComment());
        } else {
            submission.saveDraft(totalScore, request.oneLineComment());
        }

        assignment.getProgram().markEvaluationStarted();
        recomputeAssignmentStatus(assignment);

        return toSubmissionResponse(submission);
    }

    // 배정에 속한 모든 팀의 제출 현황을 보고 배정 상태를 다시 계산한다.
    private void recomputeAssignmentStatus(EvaluationAssignment assignment) {
        Set<Long> evaluableTeamIds = findEvaluableTeams(assignment.getProgram().getId()).stream()
                .map(Team::getId)
                .collect(Collectors.toSet());
        int teamCount = evaluableTeamIds.size();
        List<EvaluationSubmission> submissions = submissionRepository.findByAssignmentId(assignment.getId()).stream()
                .filter(submission -> evaluableTeamIds.contains(submission.getTeam().getId()))
                .toList();
        long submittedCount = submissions.stream()
                .filter(s -> s.getStatus() == SubmissionStatus.SUBMITTED)
                .count();
        boolean allSubmitted = teamCount > 0 && submittedCount == teamCount;
        assignment.updateProgress(allSubmitted, !submissions.isEmpty());
    }

    // 제출 엔티티와 기준별 점수 목록을 프론트 응답 형태로 변환한다.
    private EvaluationSubmissionResponse toSubmissionResponse(EvaluationSubmission submission) {
        List<EvaluationScoreResponse> scores = scoreRepository.findBySubmissionId(submission.getId()).stream()
                .map(EvaluationScoreResponse::from)
                .toList();
        return EvaluationSubmissionResponse.from(submission, scores);
    }

    // 프로그램에 속한 모든 팀의 평가 결과를 배정된 심사위원별로 조회한다.
    @Transactional(readOnly = true)
    public List<TeamEvaluationResult> getEvaluationResults(Long programId) {
        List<Team> teams = findEvaluableTeams(programId);
        List<EvaluationAssignment> assignments = assignmentRepository.findByProgramIdOrderByIdAsc(programId);

        return teams.stream()
                .map(team -> {
                    List<EvaluatorSubmissionSummary> evaluations = assignments.stream()
                            .map(assignment -> {
                                EvaluationSubmissionResponse submission = submissionRepository
                                        .findByAssignmentIdAndTeamId(assignment.getId(), team.getId())
                                        .map(this::toSubmissionResponse)
                                        .orElse(null);
                                return new EvaluatorSubmissionSummary(
                                        assignment.getEvaluator().getId(),
                                        assignment.getEvaluator().getEmail(),
                                        assignment.getEvaluator().getName(),
                                        submission
                                );
                            })
                            .toList();
                    return new TeamEvaluationResult(team.getId(), team.getDisplayName(), team.getStatus(), team.getBonusScore(), evaluations, BonusScoreResponse.from(team));
                })
                .toList();
    }

    // 배정이 없으면 평가 화면과 저장 API 모두 사용할 수 없다.
    private EvaluationAssignment findOwnedAssignment(Long assignmentId, Long evaluatorId) {
        EvaluationAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found."));
        if (!assignment.getEvaluator().getId().equals(evaluatorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Assignment does not belong to this evaluator.");
        }
        return assignment;
    }

    private Team findTeam(Long teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
    }

    private void validateTeamBelongsToProgram(Team team, Long programId) {
        if (!team.getProgram().getId().equals(programId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team does not belong to this assignment.");
        }
    }

    // 지원서로 생성된 팀은 최종 제출된 경우에만 평가 대상이다.
    // 매니저가 직접 생성한 팀은 연결된 지원서가 없으므로 기존처럼 평가할 수 있다.
    private List<Team> findEvaluableTeams(Long programId) {
        List<Team> teams = teamRepository.findByProgramIdOrderByIdAsc(programId);
        if (teams.isEmpty()) {
            return teams;
        }

        Map<Long, Boolean> submittedByTeamId = applicationRepository
                .findByTeamIdIn(teams.stream().map(Team::getId).toList()).stream()
                .collect(Collectors.toMap(
                        application -> application.getTeam().getId(),
                        Application::isSubmitted,
                        Boolean::logicalOr
                ));

        return teams.stream()
                .filter(team -> submittedByTeamId.getOrDefault(team.getId(), true))
                .toList();
    }

    private void validateTeamIsEvaluable(Team team) {
        boolean evaluable = applicationRepository.findByTeamId(team.getId())
                .map(Application::isSubmitted)
                .orElse(true);
        if (!evaluable) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Team is not available for evaluation.");
        }
    }

    // 평가 시작일 이전에는 임시저장·제출 모두 막는다. (자료 열람은 계속 허용)
    private void validateEvaluationStarted(EvaluationAssignment assignment) {
        Instant start = ProgramTimes.evaluationStart(assignment.getProgram());
        if (start != null && Instant.now().isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "평가 시작 시각 이전에는 평가할 수 없습니다.");
        }
    }

    // 평가 마감일이 지나면 임시저장·제출 모두 막는다. (자료 열람은 계속 허용)
    private void validateEvaluationNotClosed(EvaluationAssignment assignment) {
        Instant deadline = ProgramTimes.evaluationDeadline(assignment.getProgram());
        if (deadline != null && !Instant.now().isBefore(deadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "평가 마감 시각이 지나 평가할 수 없습니다.");
        }
    }

    // 점수는 해당 프로그램의 질문에 대해서만 허용하고, 값은 항목 배점 범위로 제한한다.
    private void validateScores(
            List<EvaluationScoreRequest> requestedScores,
            Map<Long, EvaluationCriterion> criteriaById,
            boolean submit
    ) {
        Set<Long> requestedCriterionIds = requestedScores.stream()
                .map(EvaluationScoreRequest::criterionId)
                .collect(Collectors.toSet());

        if (requestedCriterionIds.size() != requestedScores.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate criterion scores.");
        }
        for (EvaluationScoreRequest requestedScore : requestedScores) {
            if (!criteriaById.containsKey(requestedScore.criterionId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Criterion does not belong to this program.");
            }
            if (requestedScore.score() == null
                    || requestedScore.score().compareTo(BigDecimal.ZERO) < 0
                    || requestedScore.score().compareTo(criteriaById.get(requestedScore.criterionId()).getMaxScore()) > 0
                    || requestedScore.score().stripTrailingZeros().scale() > 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "점수는 0 이상 항목 배점 이하이며 소수 둘째 자리까지만 입력할 수 있습니다.");
            }
        }

        if (submit && !requestedCriterionIds.containsAll(criteriaById.keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All criteria must be scored before submission.");
        }
    }

    // 한줄평은 평가 대상당 하나이며, UI 표시 안정성을 위해 개행을 허용하지 않는다.
    private void validateOneLineComment(String oneLineComment) {
        if (oneLineComment == null) {
            return;
        }
        if (oneLineComment.length() > 500 || oneLineComment.contains("\n") || oneLineComment.contains("\r")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One-line comment must be 500 characters or less without line breaks.");
        }
    }

    // 총점은 질문별 점수의 평균이 아니라 단순 합계다.
    private BigDecimal calculateTotalScore(List<EvaluationScore> scores) {
        return scores.stream()
                .map(EvaluationScore::getScore)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
