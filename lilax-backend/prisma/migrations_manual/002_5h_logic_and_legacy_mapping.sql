-- ============================================================
-- MIGRACIÓN v2 - Hotel Lilax
-- 1) Nueva lógica de negocio: base 5h + recargo de 4h a MITAD de precio (no prorrateado)
-- 2) Campos de mapeo hacia el sistema Informix existente (saehabi, saeprod, etc.)
--    para que la sincronización entre plataformas sea exacta y no ambigua.
-- ============================================================

-- ------------------------------------------------------------
-- 1. AJUSTE DE LÓGICA DE TIEMPO: base 5h, recargo 4h a mitad de precio
-- ------------------------------------------------------------

-- Antes el "bloque base" no existía como concepto propio (se asumían 4h fijas).
-- Ahora lo hacemos explícito: base_hours (5h) y extra_block_hours (4h) son
-- conceptos DISTINTOS, con distinto precio.
ALTER TABLE room_categories
    ADD COLUMN IF NOT EXISTS base_hours SMALLINT NOT NULL DEFAULT 5;

-- extra_block_price ya existía; el significado cambia: ahora es la mitad del
-- precio base (mismo campo, se recalcula/valida al insertar/actualizar la categoría).
-- Se deja como columna editable (no calculada) por si algún día una categoría
-- necesita un recargo distinto a "mitad exacta", pero la app y el trigger de abajo
-- la mantienen sincronizada como base_price_4h / 2 salvo que se edite a mano.
ALTER TABLE room_categories
    ALTER COLUMN extra_block_hours SET DEFAULT 4;

-- Trigger opcional: si al crear/editar una categoría no se especifica
-- extra_block_price, se autocalcula como la mitad del precio base.
CREATE OR REPLACE FUNCTION fn_default_extra_block_price() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.extra_block_price IS NULL THEN
        NEW.extra_block_price := ROUND(NEW.base_price_4h / 2, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_default_extra_price ON room_categories;
CREATE TRIGGER trg_default_extra_price
    BEFORE INSERT OR UPDATE ON room_categories
    FOR EACH ROW EXECUTE FUNCTION fn_default_extra_block_price();

-- El alquiler (rentals) también debe guardar snapshot de base_hours
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS base_hours SMALLINT NOT NULL DEFAULT 5;

-- ------------------------------------------------------------
-- 2. CAMPOS DE MAPEO HACIA EL SISTEMA INFORMIX EXISTENTE
--    (para que el sync entre plataformas identifique registros sin ambigüedad)
-- ------------------------------------------------------------

-- Cada hotel = una sucursal en su sistema (cod_empr, cod_sucu)
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS legacy_cod_empr INTEGER,
    ADD COLUMN IF NOT EXISTS legacy_cod_sucu INTEGER;

-- Cada categoría = su "tipo de habitación" (habi_cod_tiha)
ALTER TABLE room_categories
    ADD COLUMN IF NOT EXISTS legacy_cod_tiha INTEGER;

-- Cada habitación = su habi_cod_habi
ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS legacy_cod_habi INTEGER;

-- Cada producto = su prod_cod_prod (varchar 35 en su sistema)
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS legacy_cod_prod VARCHAR(35);

-- El alquiler equivale conceptualmente a su "apertura de habitación" (saepeha)
-- y genera un "pedido de venta" (saepeve) del lado de ellos. Guardamos ambos
-- códigos una vez que el sync confirme la creación del lado de ellos, para
-- poder conciliar cualquier reporte cruzado.
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS legacy_peha_cod INTEGER,
    ADD COLUMN IF NOT EXISTS legacy_peve_cod INTEGER;

-- ------------------------------------------------------------
-- 3. REEMPLAZAR fn_check_in: ahora usa base_hours (5h) de la categoría
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_in(
    p_room_id UUID,
    p_cashier_id UUID,
    p_cash_session_id UUID
) RETURNS UUID AS $$
DECLARE
    v_hotel_id UUID;
    v_category_id UUID;
    v_base_price NUMERIC(10,2);
    v_extra_price NUMERIC(10,2);
    v_base_hours SMALLINT;
    v_extra_hours SMALLINT;
    v_rental_id UUID;
BEGIN
    SELECT r.hotel_id, r.category_id, rc.base_price_4h, rc.extra_block_price,
           rc.base_hours, rc.extra_block_hours
      INTO v_hotel_id, v_category_id, v_base_price, v_extra_price,
           v_base_hours, v_extra_hours
      FROM rooms r JOIN room_categories rc ON rc.id = r.category_id
      WHERE r.id = p_room_id AND r.status = 'libre'
      FOR UPDATE OF r;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La habitación no está libre o no existe';
    END IF;

    INSERT INTO rentals (hotel_id, room_id, cashier_id, cash_session_id, category_id,
                          base_price, extra_block_price, base_hours, extra_block_hours,
                          check_in, expected_checkout, total_amount)
    VALUES (v_hotel_id, p_room_id, p_cashier_id, p_cash_session_id, v_category_id,
            v_base_price, v_extra_price, v_base_hours, v_extra_hours,
            now(), now() + make_interval(hours => v_base_hours), v_base_price)
    RETURNING id INTO v_rental_id;

    UPDATE rooms SET status = 'ocupada' WHERE id = p_room_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental', v_rental_id,
            jsonb_build_object('event','check_in','rental_id', v_rental_id, 'room_id', p_room_id));

    RETURN v_rental_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 4. fn_apply_auto_extensions: sin cambios de fondo (ya no prorrateaba),
--    solo ahora usa base_hours para el primer vencimiento y extra_block_hours
--    para los siguientes ciclos (que ya traía la tabla). Se re-crea para
--    dejar el comentario claro de la regla de "no prorrateo".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_apply_auto_extensions() RETURNS INTEGER AS $$
DECLARE
    v_rental RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Regla: si el checkout esperado ya pasó (aunque sea por 1 minuto),
    -- se cobra el recargo COMPLETO de 4h a mitad de precio. No se prorratea.
    FOR v_rental IN
        SELECT * FROM rentals
        WHERE status IN ('activa','tiempo_extra')
          AND expected_checkout <= now()
        FOR UPDATE
    LOOP
        INSERT INTO rental_extensions (rental_id, hours, amount, auto_generated)
        VALUES (v_rental.id, v_rental.extra_block_hours, v_rental.extra_block_price, TRUE);

        UPDATE rentals
           SET status = 'tiempo_extra',
               extra_charges_total = extra_charges_total + v_rental.extra_block_price,
               total_amount = total_amount + v_rental.extra_block_price,
               expected_checkout = expected_checkout + make_interval(hours => v_rental.extra_block_hours)
         WHERE id = v_rental.id;

        UPDATE rooms SET status = 'tiempo_extra' WHERE id = v_rental.room_id;

        INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
        VALUES (v_rental.hotel_id, 'rental_extension', v_rental.id,
                jsonb_build_object('event','auto_extension','rental_id', v_rental.id,
                                    'amount', v_rental.extra_block_price));

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
