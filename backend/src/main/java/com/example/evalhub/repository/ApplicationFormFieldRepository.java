package com.example.evalhub.repository;

import com.example.evalhub.entity.ApplicationFormField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ApplicationFormFieldRepository extends JpaRepository<ApplicationFormField, Long> {

    List<ApplicationFormField> findByProgramIdOrderByDisplayOrderAsc(Long programId);

    @Modifying
    @Query("delete from ApplicationFormField f where f.program.id = :programId")
    void deleteByProgramId(Long programId);
}
