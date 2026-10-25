ALTER TABLE shop_settings
    ADD COLUMN pincode           varchar(6),
    ADD COLUMN bank_account_name varchar(150),
    ADD COLUMN bank_name         varchar(150),
    ADD COLUMN bank_account_no   varchar(30),
    ADD COLUMN bank_ifsc         varchar(11),
    ADD COLUMN upi_id            varchar(100);