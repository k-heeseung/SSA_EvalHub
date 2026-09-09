package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvaluationAssignmentRepository extends JpaRepository<EvaluationAssignment, Long> {

    List<EvaluationAssignment> findByEvaluatorIdOrderByIdDesc(Long evaluatorId);

    List<EvaluationAssignment> findByProgramIdOrderByIdAsc(Long programId);

    Optional<EvaluationAssignment> findByProgramIdAndEvaluatorId(Long programId, Long evaluatorId);

    long countByProgramId(Long programId);

    long countByEvaluatorId(Long evaluatorId);

    long countByProgramIdAndStatus(Long programId, com.example.evalhub.entity.AssignmentStatus status);
}
