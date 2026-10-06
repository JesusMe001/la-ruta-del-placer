-- ============================================================
-- Vacía los datos de prueba (habitaciones, categorías, productos,
-- alquileres, pagos, sesiones de caja) para dejar todo listo y que
-- se repueble solo con datos reales importados desde Informix.
--
-- NO borra: hotels, users (admin/cajera), loyalty_config,
-- allowed_networks, housekeeping_staff — esas no dependen de Informix.
--
-- ⚠️ Corre esto SOLO después de confirmar que "Ver habitaciones reales"
-- en Admin → Informix sí devuelve datos de verdad. Si lo corres antes
-- y la conexión sigue fallando, te quedas con el sistema sin
-- habitaciones hasta que se resuelva.
-- ============================================================

TRUNCATE TABLE
    payments,
    rental_products,
    rental_extensions,
    rentals,
    cash_sessions,
    rooms,
    room_categories,
    products,
    product_categories;
