package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvaluationScoreRepository extends JpaRepository<EvaluationScore, Long> {

    List<EvaluationScore> findBySubmissionId(Long submissionId);

    Optional<EvaluationScore> findBySubmissionIdAndCriterionId(Long submissionId, Long criterionId);
}
