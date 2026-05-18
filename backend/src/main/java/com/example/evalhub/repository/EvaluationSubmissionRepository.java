package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EvaluationSubmissionRepository extends JpaRepository<EvaluationSubmission, Long> {

    Optional<EvaluationSubmission> findByAssignmentId(Long assignmentId);
}
