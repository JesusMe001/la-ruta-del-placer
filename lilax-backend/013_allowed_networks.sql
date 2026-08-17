-- ============================================================
-- MIGRACIÓN v12 - Hotel Lilax
-- Lista de IPs/redes permitidas para acceder al menú del huésped,
-- configurable por hotel desde el panel admin (en vez de fija en
-- el .env). Si un hotel no tiene ninguna entrada aquí, se usa el
-- rango por defecto (redes privadas estándar) como respaldo.
-- ============================================================

CREATE TABLE IF NOT EXISTS allowed_networks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    cidr       VARCHAR(43) NOT NULL,   -- ej. "192.168.1.0/24" o una IP puntual "192.168.1.50/32"
    label      VARCHAR(80),            -- ej. "Wifi recepción", "Router principal"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allowed_networks_hotel ON allowed_networks(hotel_id);
