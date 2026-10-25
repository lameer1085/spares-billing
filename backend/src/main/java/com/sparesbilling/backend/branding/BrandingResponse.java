package com.sparesbilling.backend.branding;

import java.time.ZoneId;

public record BrandingResponse(String appName, boolean hasFavicon, long version) {
    public static BrandingResponse from(Branding b) {
        return new BrandingResponse(b.getAppName(), b.getFaviconData() != null,
                b.getUpdatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
    }
}