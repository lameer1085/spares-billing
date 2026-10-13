package com.sparesbilling.backend.catalog;

import com.sparesbilling.backend.common.NotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;

    @GetMapping
    public List<NameResponse> list() {
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(b -> new NameResponse(b.getId(), b.getName())).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public NameResponse create(@Valid @RequestBody NameRequest req) {
        String name = req.name().trim();
        if (categoryRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("Category already exists");
        }
        Category b = new Category();
        b.setName(name);
        b = categoryRepository.save(b);
        return new NameResponse(b.getId(), b.getName());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public NameResponse rename(@PathVariable Long id, @Valid @RequestBody NameRequest req) {
        Category b = categoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Category not found"));
        String name = req.name().trim();
        categoryRepository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw new IllegalArgumentException("Category already exists"); });
        b.setName(name);
        b = categoryRepository.save(b);
        return new NameResponse(b.getId(), b.getName());
    }
}