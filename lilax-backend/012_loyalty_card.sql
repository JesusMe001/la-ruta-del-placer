-- ============================================================
-- MIGRACIÓN v11 - Hotel Lilax
-- Configuración parametrizable de la tarjeta de fidelización
-- (Google Wallet). Por ahora solo guarda el contenido/beneficio;
-- el flujo de inscripción de clientes se construye después.
-- ============================================================

CREATE TABLE IF NOT EXISTS loyalty_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id              UUID NOT NULL UNIQUE REFERENCES hotels(id) ON DELETE CASCADE,
    program_name          VARCHAR(80) NOT NULL DEFAULT 'Extasis Club',
    discount_label        VARCHAR(120) NOT NULL DEFAULT '10% de descuento en tu próxima estadía',
    highlight_product_type VARCHAR(80),
    background_color      VARCHAR(7) NOT NULL DEFAULT '#170B22',
    active                BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
