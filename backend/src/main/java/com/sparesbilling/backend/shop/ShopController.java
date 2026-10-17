package com.sparesbilling.backend.shop;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shop")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;

    @GetMapping
    public ShopSettingsResponse get() {
        return shopService.get();
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER')")
    public ShopSettingsResponse update(@Valid @RequestBody ShopSettingsRequest req) {
        return shopService.update(req);
    }
}