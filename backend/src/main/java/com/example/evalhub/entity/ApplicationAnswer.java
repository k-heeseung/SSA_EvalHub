package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "application_answers")
@Getter
@NoArgsConstructor
public class ApplicationAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_field_id", nullable = false)
    private ApplicationFormField formField;

    // 주관식/단일 선택은 문자열, 복수 선택은 구분자로 이어붙인 문자열을 그대로 저장한다.
    @Column(columnDefinition = "text")
    private String value;

    public ApplicationAnswer(Application application, ApplicationFormField formField, String value) {
        this.application = application;
        this.formField = formField;
        this.value = value;
    }

    public void updateValue(String value) {
        this.value = value;
    }
}
