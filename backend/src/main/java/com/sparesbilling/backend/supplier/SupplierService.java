package com.sparesbilling.backend.supplier;

import com.sparesbilling.backend.common.ContactRules;
import com.sparesbilling.backend.common.NotFoundException;
import com.sparesbilling.backend.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;

    @Transactional(readOnly = true)
    public PageResponse<SupplierResponse> search(String q, boolean includeInactive, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by("name").ascending());
        return PageResponse.from(supplierRepository
                .search(ContactRules.searchPattern(q), includeInactive, pageable)
                .map(SupplierResponse::from));
    }

    @Transactional(readOnly = true)
    public SupplierResponse get(Long id) {
        return SupplierResponse.from(find(id));
    }

    @Transactional
    public SupplierResponse create(SupplierRequest req) {
        Supplier s = new Supplier();
        apply(s, req);
        return SupplierResponse.from(supplierRepository.saveAndFlush(s));
    }

    @Transactional
    public SupplierResponse update(Long id, SupplierRequest req) {
        Supplier s = find(id);
        apply(s, req);
        return SupplierResponse.from(supplierRepository.saveAndFlush(s));
    }

    @Transactional
    public SupplierResponse setActive(Long id, boolean active) {
        Supplier s = find(id);
        s.setActive(active);
        return SupplierResponse.from(s);
    }

    private Supplier find(Long id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Supplier not found"));
    }

    private void apply(Supplier s, SupplierRequest req) {
        String gstin = ContactRules.normalizeGstin(req.gstin());
        if (gstin != null) {
            supplierRepository.findByGstin(gstin)
                    .filter(other -> !other.getId().equals(s.getId()))
                    .ifPresent(other -> {
                        throw new IllegalArgumentException("A supplier with this GSTIN already exists");
                    });
        }
        s.setName(req.name().trim());
        s.setPhone(ContactRules.normalizePhone(req.phone()));
        s.setGstin(gstin);
        s.setAddress(ContactRules.blankToNull(req.address()));
        s.setStateCode(ContactRules.resolveStateCode(gstin, req.stateCode()));
    }
}