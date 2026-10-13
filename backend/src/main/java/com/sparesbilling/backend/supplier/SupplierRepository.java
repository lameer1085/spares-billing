package com.sparesbilling.backend.supplier;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Optional<Supplier> findByGstin(String gstin);

    @Query("select s from Supplier s where (:includeInactive = true or s.active = true) "
            + "and (lower(s.name) like :p or s.phone like :p or lower(coalesce(s.gstin, '')) like :p)")
    Page<Supplier> search(@Param("p") String pattern,
                          @Param("includeInactive") boolean includeInactive,
                          Pageable pageable);
}