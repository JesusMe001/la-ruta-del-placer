-- ============================================================
-- MIGRACIÓN v15 - Hotel Lilax
-- Cortesías: los dueños pueden regalar un producto, un monto fijo
-- o un porcentaje de descuento (sobre toda la cuenta o solo la
-- habitación) a un huésped frecuente o conocido, desde el admin.
-- ============================================================

ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS courtesy_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS courtesy_note TEXT;
