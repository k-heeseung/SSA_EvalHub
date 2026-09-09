package com.example.evalhub.repository;

import com.example.evalhub.entity.Application;
import com.example.evalhub.entity.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByApplicantIdOrderByUpdatedAtDesc(Long applicantId);

    Optional<Application> findByProgramIdAndApplicantId(Long programId, Long applicantId);

    List<Application> findByProgramIdAndStatus(Long programId, ApplicationStatus status);

    Optional<Application> findByTeamId(Long teamId);

    List<Application> findByTeamIdIn(List<Long> teamIds);
}
