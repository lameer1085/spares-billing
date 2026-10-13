package com.sparesbilling.backend.customer;

import com.sparesbilling.backend.common.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> search(String q, boolean includeInactive, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by("name").ascending());
        return PageResponse.from(customerRepository
                .search(ContactRules.searchPattern(q), includeInactive, pageable)
                .map(CustomerResponse::from));
    }

    @Transactional
    public CustomerResponse patch(Long id, CustomerPatchRequest req) {
        Customer c = find(id);
        if (req.name() != null && req.name().isBlank()) {
            throw new IllegalArgumentException("Name cannot be blank");
        }
        CustomerRequest merged = new CustomerRequest(
                req.name() != null ? req.name() : c.getName(),
                req.phone() != null ? req.phone() : c.getPhone(),
                req.gstin() != null ? req.gstin() : c.getGstin(),
                req.address() != null ? req.address() : c.getAddress(),
                req.stateCode() != null ? req.stateCode() : c.getStateCode(),
                req.creditLimit(), req.openingBalance());
        apply(c, merged);
        return CustomerResponse.from(customerRepository.saveAndFlush(c));
    }

    @Transactional(readOnly = true)
    public CustomerResponse get(Long id) {
        return CustomerResponse.from(find(id));
    }

    @Transactional
    public CustomerResponse create(CustomerRequest req) {
        Customer c = new Customer();
        apply(c, req);
        return CustomerResponse.from(customerRepository.saveAndFlush(c));
    }

    @Transactional
    public CustomerResponse update(Long id, CustomerRequest req) {
        Customer c = find(id);
        apply(c, req);
        return CustomerResponse.from(customerRepository.saveAndFlush(c));
    }

    @Transactional
    public CustomerResponse setActive(Long id, boolean active) {
        Customer c = find(id);
        c.setActive(active);
        return CustomerResponse.from(c);
    }

    private Customer find(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
    }

    private void apply(Customer c, CustomerRequest req) {
        String gstin = ContactRules.normalizeGstin(req.gstin());
        if (gstin != null) {
            customerRepository.findByGstin(gstin)
                    .filter(other -> !other.getId().equals(c.getId()))
                    .ifPresent(other -> {
                        throw new IllegalArgumentException("A customer with this GSTIN already exists");
                    });
        }
        c.setName(req.name().trim());
        c.setPhone(ContactRules.normalizePhone(req.phone()));
        c.setGstin(gstin);
        c.setAddress(ContactRules.blankToNull(req.address()));
        c.setStateCode(ContactRules.resolveStateCode(gstin, req.stateCode()));

        // Money-related fields: Owner only. Staff values are ignored.
        if (currentUser.isOwner()) {
            if (req.creditLimit() != null) c.setCreditLimit(req.creditLimit());
            if (req.openingBalance() != null) c.setOpeningBalance(req.openingBalance());
        }
    }
}