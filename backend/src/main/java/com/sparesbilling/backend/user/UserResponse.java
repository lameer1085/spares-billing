package com.sparesbilling.backend.user;

public record UserResponse(Long id, String username, String fullName, String role, boolean active,
                           boolean mustChangePassword) {
    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getFullName(), u.getRole().name(),
                u.isActive(), u.isMustChangePassword());
    }
}