package com.sparesbilling.backend.catalog;

import com.sparesbilling.backend.common.NotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandRepository brandRepository;

    @GetMapping
    public List<NameResponse> list() {
        return brandRepository.findAllByOrderByNameAsc().stream()
                .map(b -> new NameResponse(b.getId(), b.getName())).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public NameResponse create(@Valid @RequestBody NameRequest req) {
        String name = req.name().trim();
        if (brandRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("Brand already exists");
        }
        Brand b = new Brand();
        b.setName(name);
        b = brandRepository.save(b);
        return new NameResponse(b.getId(), b.getName());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public NameResponse rename(@PathVariable Long id, @Valid @RequestBody NameRequest req) {
        Brand b = brandRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Brand not found"));
        String name = req.name().trim();
        brandRepository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw new IllegalArgumentException("Brand already exists"); });
        b.setName(name);
        b = brandRepository.save(b);
        return new NameResponse(b.getId(), b.getName());
    }
}