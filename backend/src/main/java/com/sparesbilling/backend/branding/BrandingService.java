package com.sparesbilling.backend.branding;

import com.sparesbilling.backend.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class BrandingService {

    private static final int MAX_BYTES = 100 * 1024;

    private final BrandingRepository repository;

    @Transactional(readOnly = true)
    public Branding find() {
        return repository.findById(1).orElseThrow(() -> new NotFoundException("Branding not found"));
    }

    @Transactional
    public BrandingResponse rename(String appName) {
        Branding b = find();
        b.setAppName(appName.trim());
        b.setUpdatedAt(LocalDateTime.now());
        return BrandingResponse.from(b);
    }

    @Transactional
    public BrandingResponse setFavicon(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose an image file");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("Image must be 100 KB or smaller");
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read the file");
        }
        String type = detectType(data);
        if (type == null) throw new IllegalArgumentException("Use a PNG, JPG, WEBP or ICO image");
        Branding b = find();
        b.setFaviconData(data);
        b.setFaviconType(type);
        b.setUpdatedAt(LocalDateTime.now());
        return BrandingResponse.from(b);
    }

    @Transactional
    public BrandingResponse clearFavicon() {
        Branding b = find();
        b.setFaviconData(null);
        b.setFaviconType(null);
        b.setUpdatedAt(LocalDateTime.now());
        return BrandingResponse.from(b);
    }

    /** The type comes from the file's own first bytes, never from what the browser claims. SVG is refused on purpose. */
    private static String detectType(byte[] d) {
        if (d.length < 12) return null;
        if ((d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return "image/png";
        if ((d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (d[0] == 0 && d[1] == 0 && d[2] == 1 && d[3] == 0) return "image/x-icon";
        if (d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return "image/webp";
        return null;
    }
}