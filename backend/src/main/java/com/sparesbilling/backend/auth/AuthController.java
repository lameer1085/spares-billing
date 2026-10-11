package com.sparesbilling.backend.auth;

import com.sparesbilling.backend.security.JwtService;
import com.sparesbilling.backend.user.User;
import com.sparesbilling.backend.user.UserRepository;
import com.sparesbilling.backend.user.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.username(), req.password()));
        User u = userRepository.findByUsername(req.username()).orElseThrow();
        String token = jwtService.generateToken(u.getUsername(), u.getRole().name());
        return new LoginResponse(token, u.getUsername(), u.getFullName(), u.getRole().name());
    }

    @GetMapping("/me")
    public UserResponse me(Authentication auth) {
        User u = userRepository.findByUsername(auth.getName()).orElseThrow();
        return UserResponse.from(u);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(Authentication auth,
                                               @Valid @RequestBody ChangePasswordRequest req) {
        User u = userRepository.findByUsername(auth.getName()).orElseThrow();
        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(u);
        return ResponseEntity.noContent().build();
    }
}