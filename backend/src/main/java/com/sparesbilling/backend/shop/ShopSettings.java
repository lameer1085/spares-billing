package com.sparesbilling.backend.shop;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shop_settings")
@Getter
@Setter
@NoArgsConstructor
public class ShopSettings {

    @Id
    private Integer id = 1;

    @Column(name = "shop_name", nullable = false, length = 150)
    private String shopName;

    @Column(columnDefinition = "text")
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(length = 15)
    private String gstin;

    @Column(name = "state_code", nullable = false, length = 2)
    private String stateCode;

    @Column(name = "invoice_prefix", nullable = false, length = 10)
    private String invoicePrefix;
}