package com.example.evalhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    @Column
    private String name;

    // 숫자만 남긴 정규화 형태로 저장한다. (PhoneNumbers.normalize)
    @Column
    private String phone;

    @Column
    private String department;

    public User(String email, String password, Role role) {
        this.email = email;
        this.password = password;
        this.role = role;
    }

    public User(String email, String password, Role role, String name, String department) {
        this(email, password, role, name, null, department);
    }

    public User(String email, String password, Role role, String name, String phone, String department) {
        this(email, password, role);
        this.name = name;
        this.phone = phone;
        this.department = department;
    }

    public void changeStatus(Status status) {
        this.status = status;
    }

    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
}
