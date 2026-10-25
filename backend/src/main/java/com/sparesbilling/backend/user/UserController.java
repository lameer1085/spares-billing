package com.sparesbilling.backend.user;

import com.sparesbilling.backend.common.NotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public List<UserResponse> list() {
        return userRepository.findAll(Sort.by("username")).stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest req) {
        String username = req.username().trim();
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setFullName(req.fullName().trim());
        u.setRole(req.role());
        u.setMustChangePassword(true);
        return UserResponse.from(userRepository.save(u));
    }

    @PutMapping("/{id}")
    @Transactional
    public UserResponse update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest req,
                               Authentication auth) {
        User u = find(id);
        boolean self = u.getUsername().equals(auth.getName());
        boolean staysActiveOwner = req.active() && req.role() == Role.OWNER;
        if (self && !staysActiveOwner) {
            throw new IllegalArgumentException("You cannot deactivate yourself or remove your own Owner role");
        }
        boolean wasActiveOwner = u.getRole() == Role.OWNER && u.isActive();
        if (wasActiveOwner && !staysActiveOwner
                && userRepository.countByRoleAndActive(Role.OWNER, true) <= 1) {
            throw new IllegalArgumentException("The shop must keep at least one active Owner");
        }
        u.setFullName(req.fullName().trim());
        u.setRole(req.role());
        u.setActive(req.active());
        return UserResponse.from(u);
    }

    @PostMapping("/{id}/reset-password")
    @Transactional
    public UserResponse resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest req) {
        User u = find(id);
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        u.setMustChangePassword(true);
        return UserResponse.from(u);
    }

    private User find(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
    }
}