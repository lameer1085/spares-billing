CREATE TABLE eway_details (
                              invoice_id       bigint PRIMARY KEY REFERENCES invoices (id),
                              to_pincode       varchar(6),
                              to_place         varchar(100),
                              distance_km      integer,
                              trans_mode       smallint    NOT NULL DEFAULT 1,
                              vehicle_no       varchar(15),
                              transporter_name varchar(100),
                              transporter_id   varchar(15),
                              trans_doc_no     varchar(30),
                              trans_doc_date   date,
                              eway_bill_no     varchar(12),
                              eway_bill_date   date,
                              updated_at       timestamp   NOT NULL DEFAULT now()
);