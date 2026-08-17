-- ============================================================
-- MIGRACIÓN v3 - Hotel Lilax
-- Permite que el huésped agregue consumo directamente desde la
-- página del QR de su habitación, sin pasar por la cajera.
-- ============================================================

-- El consumo agregado por el huésped no tiene cajero asociado
ALTER TABLE rental_products
    ALTER COLUMN added_by DROP NOT NULL;

-- ------------------------------------------------------------
-- fn_guest_add_product: resuelve la habitación por su QR,
-- encuentra el alquiler activo de esa habitación, y agrega el
-- producto. No requiere autenticación — el "acceso" es el
-- propio código QR físico de la habitación.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_guest_add_product(
    p_qr_code VARCHAR,
    p_product_id UUID,
    p_quantity INT
) RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
    v_hotel_id UUID;
    v_rental_id UUID;
    v_price NUMERIC(10,2);
    v_subtotal NUMERIC(10,2);
    v_item_id UUID;
BEGIN
    SELECT id, hotel_id INTO v_room_id, v_hotel_id
      FROM rooms WHERE qr_code = p_qr_code AND active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Código QR no válido';
    END IF;

    SELECT id INTO v_rental_id FROM rentals
      WHERE room_id = v_room_id AND status IN ('activa','tiempo_extra')
      LIMIT 1;

    IF v_rental_id IS NULL THEN
        RAISE EXCEPTION 'Esta habitación no tiene un alquiler activo en este momento';
    END IF;

    SELECT price INTO v_price FROM products WHERE id = p_product_id AND active = TRUE AND hotel_id = v_hotel_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    v_subtotal := v_price * p_quantity;

    INSERT INTO rental_products (rental_id, product_id, quantity, unit_price, subtotal, added_by)
    VALUES (v_rental_id, p_product_id, p_quantity, v_price, v_subtotal, NULL)
    RETURNING id INTO v_item_id;

    UPDATE rentals
       SET products_total = products_total + v_subtotal,
           total_amount = total_amount + v_subtotal
     WHERE id = v_rental_id;

    UPDATE products SET stock = stock - p_quantity WHERE id = p_product_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental_product', v_item_id,
            jsonb_build_object('event','product_added_by_guest','rental_id', v_rental_id,
                                'product_id', p_product_id, 'quantity', p_quantity, 'subtotal', v_subtotal));

    RETURN v_rental_id;
END;
$$ LANGUAGE plpgsql;
