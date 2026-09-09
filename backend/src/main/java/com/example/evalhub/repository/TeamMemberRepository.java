package com.example.evalhub.repository;

import com.example.evalhub.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByTeamIdOrderByIdAsc(Long teamId);

    Optional<TeamMember> findByTeamIdAndMemberId(Long teamId, Long memberId);

    long countByTeamId(Long teamId);
}
