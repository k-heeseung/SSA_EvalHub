package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EvaluationService {

    private final EvaluationAssignmentRepository assignmentRepository;
    private final EvaluationCriterionRepository criterionRepository;
    private final EvaluationSubmissionRepository submissionRepository;
    private final EvaluationScoreRepository scoreRepository;
    private final ParticipantAttachmentRepository attachmentRepository;
    private final ProgramParticipantRepository participantRepository;

    public EvaluationService(
            EvaluationAssignmentRepository assignmentRepository,
            EvaluationCriterionRepository criterionRepository,
            EvaluationSubmissionRepository submissionRepository,
            EvaluationScoreRepository scoreRepository,
            ParticipantAttachmentRepository attachmentRepository,
            ProgramParticipantRepository participantRepository
    ) {
        this.assignmentRepository = assignmentRepository;
        this.criterionRepository = criterionRepository;
        this.submissionRepository = submissionRepository;
        this.scoreRepository = scoreRepository;
        this.attachmentRepository = attachmentRepository;
        this.participantRepository = participantRepository;
    }

    // 평가 화면 초기 데이터: 배정, 프로그램, 평가 대상, 질문, PDF, 기존 제출 내용을 조립한다.
    @Transactional(readOnly = true)
    public EvaluationViewResponse getEvaluationView(Long assignmentId) {
        EvaluationAssignment assignment = findAssignment(assignmentId);
        ProgramParticipant participant = assignment.getParticipant();

        List<CriterionResponse> criteria = criterionRepository
                .findByProgramIdOrderByDisplayOrderAsc(assignment.getProgram().getId())
                .stream()
                .map(CriterionResponse::from)
                .toList();

        List<ParticipantAttachmentResponse> attachments = attachmentRepository
                .findByParticipantIdOrderByUploadedAtDesc(participant.getId())
                .stream()
                .map(ParticipantAttachmentResponse::from)
                .toList();

        EvaluationSubmissionResponse submission = submissionRepository.findByAssignmentId(assignmentId)
                .map(this::toSubmissionResponse)
                .orElse(null);

        return new EvaluationViewResponse(
                AssignmentResponse.from(assignment),
                ProgramResponse.from(assignment.getProgram()),
                TeamResponse.from(participant.getTeam(), participant),
                criteria,
                attachments,
                submission
        );
    }

    // 작성 중인 평가는 일부 질문만 점수가 있어도 저장할 수 있다.
    @Transactional
    public EvaluationSubmissionResponse saveDraft(Long assignmentId, SaveEvaluationRequest request) {
        return save(assignmentId, request, false);
    }

    // 최종 제출은 모든 질문에 0~10점 점수가 있어야 가능하다.
    @Transactional
    public EvaluationSubmissionResponse submit(Long assignmentId, SaveEvaluationRequest request) {
        return save(assignmentId, request, true);
    }

    // 임시저장과 제출이 공유하는 저장 로직이다.
    private EvaluationSubmissionResponse save(Long assignmentId, SaveEvaluationRequest request, boolean submit) {
        EvaluationAssignment assignment = findAssignment(assignmentId);
        validateOneLineComment(request.oneLineComment());

        List<EvaluationCriterion> criteria = criterionRepository
                .findByProgramIdOrderByDisplayOrderAsc(assignment.getProgram().getId());
        Map<Long, EvaluationCriterion> criteriaById = criteria.stream()
                .collect(Collectors.toMap(EvaluationCriterion::getId, Function.identity()));

        List<EvaluationScoreRequest> requestedScores = request.scores() == null ? List.of() : request.scores();
        validateScores(requestedScores, criteriaById.keySet(), submit);

        EvaluationSubmission submission = submissionRepository.findByAssignmentId(assignmentId)
                .orElseGet(() -> submissionRepository.save(new EvaluationSubmission(assignment)));

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
        BigDecimal totalScore = calculateAverageScore(savedScores);

        if (submit) {
            if (savedScores.size() != criteria.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All criteria must be scored before submission.");
            }
            submission.submit(totalScore, request.oneLineComment());
            assignment.markSubmitted();
        } else {
            submission.saveDraft(totalScore, request.oneLineComment());
            assignment.markInProgress();
        }

        return toSubmissionResponse(submission);
    }

    // 제출 엔티티와 기준별 점수 목록을 프론트 응답 형태로 변환한다.
    private EvaluationSubmissionResponse toSubmissionResponse(EvaluationSubmission submission) {
        List<EvaluationScoreResponse> scores = scoreRepository.findBySubmissionId(submission.getId()).stream()
                .map(EvaluationScoreResponse::from)
                .toList();
        return EvaluationSubmissionResponse.from(submission, scores);
    }

    // 배정이 없으면 평가 화면과 저장 API 모두 사용할 수 없다.
    private EvaluationAssignment findAssignment(Long assignmentId) {
        return assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found."));
    }

    // 점수는 해당 프로그램의 질문에 대해서만 허용하고, 값은 0~10 범위로 제한한다.
    private void validateScores(
            List<EvaluationScoreRequest> requestedScores,
            Set<Long> criterionIds,
            boolean submit
    ) {
        Set<Long> requestedCriterionIds = requestedScores.stream()
                .map(EvaluationScoreRequest::criterionId)
                .collect(Collectors.toSet());

        for (EvaluationScoreRequest requestedScore : requestedScores) {
            if (!criterionIds.contains(requestedScore.criterionId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Criterion does not belong to this program.");
            }
            if (requestedScore.score() == null
                    || requestedScore.score().compareTo(BigDecimal.ZERO) < 0
                    || requestedScore.score().compareTo(BigDecimal.TEN) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score must be between 0 and 10.");
            }
        }

        if (submit && !requestedCriterionIds.containsAll(criterionIds)) {
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

    // 현재 총점은 입력된 질문 점수의 단순 평균이다. 가중치 계산이 필요하면 이 메서드만 바꾸면 된다.
    private BigDecimal calculateAverageScore(List<EvaluationScore> scores) {
        if (scores.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = scores.stream()
                .map(EvaluationScore::getScore)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(scores.size()), 2, RoundingMode.HALF_UP);
    }
}
