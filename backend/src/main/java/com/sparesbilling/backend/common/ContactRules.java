package com.sparesbilling.backend.common;

public final class ContactRules {

    private ContactRules() {}

    public static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Returns an upper-case valid GSTIN, or null if blank. Throws if invalid. */
    public static String normalizeGstin(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String g = raw.trim().toUpperCase();
        if (!GstinValidator.isValid(g)) {
            throw new IllegalArgumentException("Invalid GSTIN");
        }
        return g;
    }

    /** If a GSTIN is given, its first two digits ARE the state. Otherwise use the given code. */
    public static String resolveStateCode(String gstin, String stateCode) {
        if (gstin != null) return gstin.substring(0, 2);
        if (stateCode == null || stateCode.isBlank()) return null;
        String s = stateCode.trim();
        if (!StateCodes.isValid(s)) {
            throw new IllegalArgumentException("Invalid state code");
        }
        return s;
    }

    public static String normalizePhone(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String p = raw.replaceAll("[\\s-]", "");
        if (!p.matches("^\\+?[0-9]{8,15}$")) {
            throw new IllegalArgumentException("Invalid phone number");
        }
        return p;
    }

    /** Builds the LIKE pattern used by the search queries. */
    public static String searchPattern(String q) {
        if (q == null || q.isBlank()) return "%";
        return "%" + q.trim().toLowerCase().replace("%", "").replace("_", "") + "%";
    }
}