package com.example.evalhub.service;

import com.example.evalhub.entity.Role;
import com.example.evalhub.invitation.EvaluatorInvitationService;
import com.example.evalhub.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
    private final UserRepository users;
    private final EvaluatorInvitationService invitations;

    public AccountDeletionService(UserRepository users, EvaluatorInvitationService invitations) {
        this.users = users;
        this.invitations = invitations;
    }

    @Transactional(readOnly = true)
    public boolean canManagerDelete(Long id) {
        // Missing accounts are handled as 404 by the deletion operation.
        return users.findById(id).map(user -> user.getRole() == Role.EVALUATOR || user.getRole() == Role.MEMBER).orElse(true);
    }

    @Transactional
    public void deleteUser(Long id) {
        var user = users.findLockedById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        if (user.getRole() == Role.EVALUATOR) {
            user.deleteEvaluatorAccount();
            // Cancel pending invitations and erase the retained temporary password.
            invitations.passwordChanged(id);
        } else {
            users.delete(user);
        }
    }
}
