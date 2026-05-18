package com.example.evalhub.repository;

import com.example.evalhub.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, Long> {

    List<Team> findByProgramIdOrderByIdAsc(Long programId);
}
