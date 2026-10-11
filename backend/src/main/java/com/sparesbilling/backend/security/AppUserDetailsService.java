package com.sparesbilling.backend.security;

import com.sparesbilling.backend.user.User;
import com.sparesbilling.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AppUserDetailsService implements UserDetailsService {
//AppUserDetailsService acts as the bridge between your application's user database and Spring Security.
//AppUserDetailsService does three main things:
//    Looks up the application user by username.
//    Throws an exception if the user does not exist.
//    Converts the entity's username, stored password hash, role, and active status into a Spring Security UserDetails object.
    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User u = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return org.springframework.security.core.userdetails.User.withUsername(u.getUsername())
                .password(u.getPasswordHash())
                .roles(u.getRole().name())
                .disabled(!u.isActive())
                .build();
    }
}