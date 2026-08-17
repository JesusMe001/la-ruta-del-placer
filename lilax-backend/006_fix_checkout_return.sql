-- ============================================================
-- MIGRACIÓN v5 - Hotel Lilax
-- Corrige fn_check_out: estaba declarada RETURNS VOID, y Prisma
-- no puede deserializar una columna de tipo void desde $queryRaw.
-- Ahora devuelve el id del alquiler cerrado.
--
-- Postgres no permite cambiar el tipo de retorno de una función
-- existente con CREATE OR REPLACE, así que primero se elimina.
-- ============================================================

DROP FUNCTION IF EXISTS fn_check_out(uuid, uuid);

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

    UPDATE rooms SET status = 'limpieza' WHERE id = v_room_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental', p_rental_id,
            jsonb_build_object('event','check_out','rental_id', p_rental_id));

    RETURN p_rental_id;
END;
$$ LANGUAGE plpgsql;
