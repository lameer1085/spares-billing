package com.sparesbilling.backend.auth;

public record LoginResponse(String token, String username, String fullName, String role,
                            boolean mustChangePassword) {}