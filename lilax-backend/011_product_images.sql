-- ============================================================
-- MIGRACIÓN v10 - Hotel Lilax
-- Agrega imagen a los productos (para que se vean en el menú
-- del huésped, no solo el nombre y precio).
-- ============================================================

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image_url TEXT;
