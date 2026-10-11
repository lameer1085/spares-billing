package com.sparesbilling.backend.common;

import com.sparesbilling.backend.user.Role;
import com.sparesbilling.backend.user.User;
import com.sparesbilling.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.initial-owner.username}")
    private String ownerUsername;

    @Value("${app.initial-owner.password}")
    private String ownerPassword;

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            User owner = new User();
            owner.setUsername(ownerUsername);
            owner.setPasswordHash(passwordEncoder.encode(ownerPassword));
            owner.setFullName("Shop Owner");
            owner.setRole(Role.OWNER);
            userRepository.save(owner);
            log.warn("Created initial OWNER user '{}'. Change this password immediately!", ownerUsername);
        }
    }
}