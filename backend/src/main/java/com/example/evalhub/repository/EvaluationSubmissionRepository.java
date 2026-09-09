package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EvaluationSubmissionRepository extends JpaRepository<EvaluationSubmission, Long> {

    Optional<EvaluationSubmission> findByAssignmentIdAndTeamId(Long assignmentId, Long teamId);

    List<EvaluationSubmission> findByAssignmentId(Long assignmentId);

    List<EvaluationSubmission> findByAssignmentIdIn(Collection<Long> assignmentIds);
}
