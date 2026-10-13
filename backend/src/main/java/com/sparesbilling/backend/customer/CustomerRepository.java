package com.sparesbilling.backend.customer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByGstin(String gstin);

    @Query("select c from Customer c where (:includeInactive = true or c.active = true) "
            + "and (lower(c.name) like :p or c.phone like :p or lower(coalesce(c.gstin, '')) like :p)")
    Page<Customer> search(@Param("p") String pattern,
                          @Param("includeInactive") boolean includeInactive,
                          Pageable pageable);
}