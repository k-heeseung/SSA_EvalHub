package com.example.evalhub.repository;

import com.example.evalhub.entity.EvaluationCriterion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvaluationCriterionRepository extends JpaRepository<EvaluationCriterion, Long> {

    List<EvaluationCriterion> findByProgramIdOrderByDisplayOrderAsc(Long programId);
}
