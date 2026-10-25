ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE branding (
                          id           integer PRIMARY KEY CHECK (id = 1),
                          app_name     varchar(60) NOT NULL,
                          favicon_data bytea,
                          favicon_type varchar(50),
                          updated_at   timestamp   NOT NULL DEFAULT now()
);
INSERT INTO branding (id, app_name) VALUES (1, 'Spares Billing');