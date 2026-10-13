package com.sparesbilling.backend.catalog;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findAll(Specification<Product> spec, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Optional<Product> findById(Long id);

    @EntityGraph(attributePaths = {"brand", "category"})
    @Query("select p from Product p where p.active = true and p.minStock > 0 "
            + "and p.stockQty <= p.minStock order by p.stockQty asc, p.name asc")
    List<Product> findLowStock();

    /** Locks the row so two people billing the same part at once cannot corrupt stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);
}