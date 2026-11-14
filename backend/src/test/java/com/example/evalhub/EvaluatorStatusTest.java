package com.example.evalhub;

import com.example.evalhub.dto.ChangeStatusRequest;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.Status;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.UserRepository;
import com.example.evalhub.service.ProgramManagementService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvaluatorStatusTest {
    @Mock UserRepository users;
    @InjectMocks ProgramManagementService service;

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"SUPER_ADMIN", "MANAGER", "MEMBER"})
    void rejectsOtherRolesWithoutChangingTheirStatus(Role role) {
        User target = new User("target@example.com", "unused", role);
        when(users.findLockedById(1L)).thenReturn(Optional.of(target));

        var error = assertThrows(ResponseStatusException.class,
                () -> service.changeEvaluatorStatus(1L, new ChangeStatusRequest(Status.INACTIVE)));

        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(target.getStatus()).isEqualTo(Status.ACTIVE);
    }

    @Test
    void evaluatorCanBeDeactivatedAndReactivated() {
        User target = new User("evaluator@example.com", "unused", Role.EVALUATOR);
        when(users.findLockedById(1L)).thenReturn(Optional.of(target));

        assertThat(service.changeEvaluatorStatus(1L, new ChangeStatusRequest(Status.INACTIVE)).status())
                .isEqualTo(Status.INACTIVE);
        assertThat(target.getStatus()).isEqualTo(Status.INACTIVE);
        assertThat(service.changeEvaluatorStatus(1L, new ChangeStatusRequest(Status.ACTIVE)).status())
                .isEqualTo(Status.ACTIVE);
        assertThat(target.getStatus()).isEqualTo(Status.ACTIVE);
    }

    @Test
    void missingUserRemainsNotFound() {
        when(users.findLockedById(1L)).thenReturn(Optional.empty());

        var error = assertThrows(ResponseStatusException.class,
                () -> service.changeEvaluatorStatus(1L, new ChangeStatusRequest(Status.INACTIVE)));

        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
