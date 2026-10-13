package com.sparesbilling.backend.common;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class StateCodes {

    private static final Map<String, String> STATES = new LinkedHashMap<>();

    static {
        STATES.put("01", "Jammu and Kashmir");
        STATES.put("02", "Himachal Pradesh");
        STATES.put("03", "Punjab");
        STATES.put("04", "Chandigarh");
        STATES.put("05", "Uttarakhand");
        STATES.put("06", "Haryana");
        STATES.put("07", "Delhi");
        STATES.put("08", "Rajasthan");
        STATES.put("09", "Uttar Pradesh");
        STATES.put("10", "Bihar");
        STATES.put("11", "Sikkim");
        STATES.put("12", "Arunachal Pradesh");
        STATES.put("13", "Nagaland");
        STATES.put("14", "Manipur");
        STATES.put("15", "Mizoram");
        STATES.put("16", "Tripura");
        STATES.put("17", "Meghalaya");
        STATES.put("18", "Assam");
        STATES.put("19", "West Bengal");
        STATES.put("20", "Jharkhand");
        STATES.put("21", "Odisha");
        STATES.put("22", "Chhattisgarh");
        STATES.put("23", "Madhya Pradesh");
        STATES.put("24", "Gujarat");
        STATES.put("26", "Dadra and Nagar Haveli and Daman and Diu");
        STATES.put("27", "Maharashtra");
        STATES.put("29", "Karnataka");
        STATES.put("30", "Goa");
        STATES.put("31", "Lakshadweep");
        STATES.put("32", "Kerala");
        STATES.put("33", "Tamil Nadu");
        STATES.put("34", "Puducherry");
        STATES.put("35", "Andaman and Nicobar Islands");
        STATES.put("36", "Telangana");
        STATES.put("37", "Andhra Pradesh");
        STATES.put("38", "Ladakh");
        STATES.put("97", "Other Territory");
    }

    private StateCodes() {}

    public static boolean isValid(String code) {
        return code != null && STATES.containsKey(code);
    }

    public static String name(String code) {
        return code == null ? null : STATES.get(code);
    }

    public static Map<String, String> all() {
        return Collections.unmodifiableMap(STATES);
    }
}