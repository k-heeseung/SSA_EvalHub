package com.example.evalhub.repository;

import com.example.evalhub.entity.ApplicationAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ApplicationAnswerRepository extends JpaRepository<ApplicationAnswer, Long> {

    List<ApplicationAnswer> findByApplicationId(Long applicationId);

    // 주어진 양식 항목들 중 이미 답변이 달린 것의 id만 추린다.
    // 항목 삭제가 지원자 답변을 cascade로 지우는 것을 막기 위한 사전 확인용이다.
    @Query("select distinct a.formField.id from ApplicationAnswer a where a.formField.id in :fieldIds")
    List<Long> findAnsweredFieldIds(@Param("fieldIds") Collection<Long> fieldIds);
}
