package com.sparesbilling.backend.common;

import com.sparesbilling.backend.user.User;
import com.sparesbilling.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

//who is logged in right now; used for audit columns and role checks
@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UserRepository userRepository;

    public Long id() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null) return null;
        return userRepository.findByUsername(a.getName()).map(User::getId).orElse(null);
    }

    public boolean isOwner() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream()
                .anyMatch(g -> g.getAuthority().equals("ROLE_OWNER"));
    }
}