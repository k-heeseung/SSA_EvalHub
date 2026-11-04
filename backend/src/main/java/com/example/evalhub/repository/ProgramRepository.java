package com.example.evalhub.repository;

import com.example.evalhub.entity.Program;
import com.example.evalhub.entity.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ProgramRepository extends JpaRepository<Program, Long> {

    // 지원자에게 공개되는(모집 중) 프로그램. 마감 임박순으로 정렬한다.
    List<Program> findByStatusOrderByApplicationDeadlineAsc(Status status);

    // 지원자 홈에 공개되는 프로그램(접수 중 + 접수 예정). 마감 임박순으로 정렬한다.
    List<Program> findByStatusInOrderByApplicationDeadlineAsc(Collection<Status> statuses);

    List<Program> findByStatusInOrderByApplicationDeadlineAtAsc(Collection<Status> statuses);

    // 특정 매니저가 담당하는 프로그램 수. 매니저 관리 화면에서 사용한다.
    long countByManagerId(Long managerId);
}
