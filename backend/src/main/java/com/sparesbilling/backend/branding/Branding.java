package com.sparesbilling.backend.branding;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "branding")
@Getter
@Setter
@NoArgsConstructor
public class Branding {

    @Id
    private Integer id = 1;

    @Column(name = "app_name", nullable = false, length = 60)
    private String appName;

    @Column(name = "favicon_data", columnDefinition = "bytea")
    private byte[] faviconData;

    @Column(name = "favicon_type", length = 50)
    private String faviconType;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}