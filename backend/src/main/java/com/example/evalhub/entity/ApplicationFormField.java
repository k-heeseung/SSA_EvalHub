package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "application_form_fields")
@Getter
@NoArgsConstructor
public class ApplicationFormField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @Column(nullable = false)
    private String label;

    @Column(name = "field_type", nullable = false)
    private String fieldType;

    @Column(nullable = false)
    private boolean required;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    // 객관식/체크박스/드롭다운 유형의 선택지. 줄바꿈으로 구분한다. 그 외 유형은 null.
    @Column(columnDefinition = "text")
    private String options;

    public ApplicationFormField(Program program, String label, String fieldType, boolean required, Integer displayOrder, String options) {
        this.program = program;
        this.label = label;
        this.fieldType = fieldType;
        this.required = required;
        this.displayOrder = displayOrder;
        this.options = options;
    }

    // 항목을 제자리에서 수정한다. id가 유지되므로 이 항목에 달린 답변(ApplicationAnswer)이 보존된다.
    public void update(String label, String fieldType, boolean required, Integer displayOrder, String options) {
        this.label = label;
        this.fieldType = fieldType;
        this.required = required;
        this.displayOrder = displayOrder;
        this.options = options;
    }
}
