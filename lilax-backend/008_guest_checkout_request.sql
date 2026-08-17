-- ============================================================
-- MIGRACIÓN v7 - Hotel Lilax
-- Permite que el huésped pida la cuenta desde su cuarto,
-- indicando cómo prefiere pagar. La cajera lo ve como alerta.
-- ============================================================

ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS checkout_requested BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS checkout_requested_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS checkout_requested_at TIMESTAMPTZ;
