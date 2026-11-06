package com.example.evalhub.repository;

import com.example.evalhub.entity.ApplicationFormField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApplicationFormFieldRepository extends JpaRepository<ApplicationFormField, Long> {

    List<ApplicationFormField> findByProgramIdOrderByDisplayOrderAsc(Long programId);

    // 주의: 프로그램의 양식 항목을 한 번에 지우는 메서드는 두지 않는다.
    // application_answers.form_field_id가 on delete cascade라 지원자 답변까지 함께 삭제된다.
    // 항목 저장은 ProgramManagementService.replaceFormFields의 diff 방식을 사용한다.
}
