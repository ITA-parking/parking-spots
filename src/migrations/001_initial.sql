CREATE TABLE parking_region (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE operating_hours (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parking_region_id UUID NOT NULL REFERENCES parking_region(id) ON DELETE CASCADE,
    day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    open_time        TIME NOT NULL,
    close_time       TIME NOT NULL
);

CREATE TABLE pricing (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parking_region_id UUID NOT NULL REFERENCES parking_region(id) ON DELETE CASCADE,
    price_per_hour   NUMERIC(10, 2) NOT NULL,
    currency         TEXT NOT NULL DEFAULT 'EUR',
    valid_from       DATE NOT NULL,
    valid_to         DATE
);
