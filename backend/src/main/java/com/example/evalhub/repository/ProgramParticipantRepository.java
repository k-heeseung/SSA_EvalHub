package com.example.evalhub.repository;

import com.example.evalhub.entity.ProgramParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgramParticipantRepository extends JpaRepository<ProgramParticipant, Long> {

    List<ProgramParticipant> findByProgramIdOrderByIdAsc(Long programId);

    Optional<ProgramParticipant> findByTeamId(Long teamId);
}
