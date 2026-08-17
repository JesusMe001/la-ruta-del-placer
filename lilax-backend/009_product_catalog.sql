-- ============================================================
-- MIGRACIÓN v8 - Hotel Lilax
-- Crea las categorías de producto (equivalente a "tipo de producto"
-- / prod_cod_tpro en el sistema Informix existente), asigna los
-- productos ya sembrados a su categoría correspondiente, y agrega
-- el resto del catálogo (comida, aseo, juguetes) con código interno
-- y campo legacy_cod_prod listo para mapear contra el sistema real
-- cuando entreguen los códigos oficiales de allá.
-- ============================================================

-- ---------- CATEGORÍAS ----------
INSERT INTO product_categories (id, hotel_id, name)
SELECT gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', cat
FROM (VALUES ('Bebidas'), ('Comida'), ('Aseo'), ('Juguetes')) AS c(cat)
ON CONFLICT DO NOTHING;

-- ---------- ASIGNAR CATEGORÍA A LOS PRODUCTOS YA SEMBRADOS ----------
UPDATE products p
   SET category_id = pc.id
  FROM product_categories pc
 WHERE p.hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959'
   AND pc.hotel_id = p.hotel_id
   AND (
        (p.internal_code IN ('BEB-001','BEB-002','BEB-003') AND pc.name = 'Bebidas')
     OR (p.internal_code = 'SNK-001' AND pc.name = 'Comida')
     OR (p.internal_code = 'AMN-001' AND pc.name = 'Aseo')
   );

-- ---------- CATÁLOGO ADICIONAL (comida, aseo, juguetes) ----------
INSERT INTO products (id, hotel_id, category_id, internal_code, name, price, cost, stock, active)
SELECT gen_random_uuid(), '44a065fb-6dd0-490f-a1db-755eca13a959', pc.id, prod.internal_code, prod.name, prod.price, prod.cost, prod.stock, true
FROM (VALUES
  -- Bebidas
  ('BEB-004', 'Gaseosa 1.5L', 4.00, 1.60, 20, 'Bebidas'),
  ('BEB-005', 'Energizante', 3.50, 1.50, 25, 'Bebidas'),
  -- Comida
  ('CMD-001', 'Sanduche mixto', 5.50, 2.20, 15, 'Comida'),
  ('CMD-002', 'Combo pizza personal', 8.00, 3.50, 10, 'Comida'),
  ('CMD-003', 'Papas fritas porción', 3.50, 1.30, 20, 'Comida'),
  ('CMD-004', 'Alitas BBQ (6 uds)', 7.50, 3.00, 12, 'Comida'),
  -- Aseo / amenities
  ('AMN-002', 'Toalla adicional', 2.00, 0.70, 30, 'Aseo'),
  ('AMN-003', 'Set de aseo íntimo', 3.00, 1.10, 25, 'Aseo'),
  -- Juguetes / bienestar de pareja
  ('JUG-001', 'Preservativos (caja x3)', 4.00, 1.50, 40, 'Juguetes'),
  ('JUG-002', 'Lubricante íntimo', 6.00, 2.50, 20, 'Juguetes'),
  ('JUG-003', 'Kit para parejas', 15.00, 6.50, 10, 'Juguetes'),
  ('JUG-004', 'Vibrador personal', 20.00, 9.00, 8, 'Juguetes')
) AS prod(internal_code, name, price, cost, stock, category_name)
JOIN product_categories pc
  ON pc.hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959' AND pc.name = prod.category_name
ON CONFLICT (hotel_id, internal_code) DO NOTHING;

-- ---------- VERIFICACIÓN ----------
SELECT pc.name AS categoria, count(p.id) AS productos
FROM product_categories pc
LEFT JOIN products p ON p.category_id = pc.id
WHERE pc.hotel_id = '44a065fb-6dd0-490f-a1db-755eca13a959'
GROUP BY pc.name
ORDER BY pc.name;
