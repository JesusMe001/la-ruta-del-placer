-- ============================================================
-- MIGRACIÓN v14 - Hotel Lilax
-- Flujo de limpieza: al hacer checkout, la habitación ya no pasa
-- directo a "limpieza" (en progreso) sino a "pendiente_limpieza"
-- (esperando a que alguien la tome). El personal de limpieza
-- escanea su credencial (código personal) en una página pública
-- sin login para tomar y luego marcar terminada cada habitación.
-- ============================================================

-- Nuevo valor del enum room_status. No se puede quitar 'limpieza',
-- así que ahora significa "en limpieza ahora mismo" (ya tomada).
ALTER TYPE room_status ADD VALUE IF NOT EXISTS 'pendiente_limpieza';

-- ---------- PERSONAL DE LIMPIEZA ----------
CREATE TABLE IF NOT EXISTS housekeeping_staff (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    code       VARCHAR(32) NOT NULL,   -- credencial personal (va codificada en su QR)
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(hotel_id, code)
);

-- ---------- ACTUALIZAR fn_check_out: ahora deja la habitación en
-- "pendiente_limpieza" (esperando que el personal la tome), no
-- directo en "limpieza" (que ahora significa "ya la están limpiando").
-- ---------- QUIÉN ESTÁ LIMPIANDO CADA HABITACIÓN AHORA ----------
ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS cleaning_staff_id UUID REFERENCES housekeeping_staff(id),
    ADD COLUMN IF NOT EXISTS cleaning_claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION fn_check_out(
    p_rental_id UUID,
    p_cashier_id UUID
) RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
    v_hotel_id UUID;
BEGIN
    SELECT room_id, hotel_id INTO v_room_id, v_hotel_id FROM rentals
     WHERE id = p_rental_id AND status IN ('activa','tiempo_extra')
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Alquiler no encontrado o ya finalizado';
    END IF;

    UPDATE rentals
       SET status = 'finalizada',
           check_out = now()
     WHERE id = p_rental_id;

    UPDATE rooms SET status = 'pendiente_limpieza' WHERE id = v_room_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental', p_rental_id,
            jsonb_build_object('event','check_out','rental_id', p_rental_id));

    RETURN p_rental_id;
END;
$$ LANGUAGE plpgsql;
