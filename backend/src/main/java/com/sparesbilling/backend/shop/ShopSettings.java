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

    @Column(length = 6)
    private String pincode;

    @Column(name = "bank_account_name", length = 150)
    private String bankAccountName;

    @Column(name = "bank_name", length = 150)
    private String bankName;

    @Column(name = "bank_account_no", length = 30)
    private String bankAccountNo;

    @Column(name = "bank_ifsc", length = 11)
    private String bankIfsc;

    @Column(name = "upi_id", length = 100)
    private String upiId;
}