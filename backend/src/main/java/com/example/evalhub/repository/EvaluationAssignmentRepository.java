package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvaluationAssignmentRepository extends JpaRepository<EvaluationAssignment, Long> {

    List<EvaluationAssignment> findByEvaluatorIdOrderByIdDesc(Long evaluatorId);

    Optional<EvaluationAssignment> findByParticipantIdAndEvaluatorId(Long participantId, Long evaluatorId);
}
