-- ============================================================
-- MIGRACIÓN v16 - Hotel Lilax
-- Cuando se aplica una cortesía de descuento (no producto), la
-- cajera debe enterarse — se le muestra como alerta hasta que la
-- marque como vista. La cortesía de producto ya se notifica sola
-- reutilizando el sistema de "entregas pendientes" existente.
-- ============================================================

ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS courtesy_acknowledged BOOLEAN NOT NULL DEFAULT TRUE;
