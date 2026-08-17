-- ============================================================
-- Datos de prueba: categorías, habitaciones y productos
-- Hotel Lilax (id: 44a065fb-6dd0-490f-a1db-755eca13a959)
-- ============================================================

-- ---------- CATEGORÍAS DE HABITACIÓN ----------
-- extra_block_price se autocalcula como la mitad de base_price_4h (trigger ya instalado)
INSERT INTO room_categories (id, hotel_id, name, description, base_price_4h, base_hours, extra_block_hours, capacity)
VALUES
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'Estándar', 'Habitación estándar', 25.00, 5, 4, 2),
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'Suite Jacuzzi', 'Suite con jacuzzi privado', 40.00, 5, 4, 2)
ON CONFLICT DO NOTHING;

-- ---------- HABITACIONES ----------
-- Vinculamos cada habitación a su categoría usando una subconsulta por nombre
INSERT INTO rooms (id, hotel_id, category_id, number, floor, qr_code, status)
SELECT gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', rc.id, room.number, room.floor, room.qr_code, 'libre'
FROM (VALUES
  ('101', '1', 'qr-lilax-101-a1x9'),
  ('102', '1', 'qr-lilax-102-b2y8'),
  ('103', '1', 'qr-lilax-103-c3z7'),
  ('201', '2', 'qr-lilax-201-d4w6'),
  ('202', '2', 'qr-lilax-202-e5v5')
) AS room(number, floor, qr_code)
JOIN room_categories rc
  ON rc.hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959'
  AND rc.name = (CASE WHEN room.number IN ('201','202') THEN 'Suite Jacuzzi' ELSE 'Estándar' END)
ON CONFLICT DO NOTHING;

-- ---------- PRODUCTOS (consumo / minibar) ----------
INSERT INTO products (id, hotel_id, internal_code, name, price, cost, stock, active)
VALUES
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'BEB-001', 'Agua embotellada', 1.50, 0.60, 50, true),
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'BEB-002', 'Cerveza nacional', 3.00, 1.20, 40, true),
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'BEB-003', 'Refresco 350ml', 2.00, 0.80, 40, true),
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'SNK-001', 'Snack / picada', 4.00, 1.80, 25, true),
  (gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', 'AMN-001', 'Kit de aseo', 2.50, 1.00, 30, true)
ON CONFLICT DO NOTHING;

-- ---------- VERIFICACIÓN ----------
SELECT 'Categorías' AS tabla, count(*) FROM room_categories WHERE hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959'
UNION ALL
SELECT 'Habitaciones', count(*) FROM rooms WHERE hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959'
UNION ALL
SELECT 'Productos', count(*) FROM products WHERE hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959';
