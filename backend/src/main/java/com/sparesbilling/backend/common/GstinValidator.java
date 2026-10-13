package com.sparesbilling.backend.common;

import java.util.regex.Pattern;

public final class GstinValidator {

    private static final Pattern FORMAT =
            Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final String CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private GstinValidator() {}

    public static boolean isValid(String gstin) {
        if (gstin == null || !FORMAT.matcher(gstin).matches()) return false;
        if (!StateCodes.isValid(gstin.substring(0, 2))) return false;

        int sum = 0;
        for (int i = 0; i < 14; i++) {
            int value = CHARS.indexOf(gstin.charAt(i));
            int product = value * (i % 2 == 0 ? 1 : 2);
            sum += product / 36 + product % 36;
        }
        int check = (36 - (sum % 36)) % 36;
        return CHARS.charAt(check) == gstin.charAt(14);
    }
}