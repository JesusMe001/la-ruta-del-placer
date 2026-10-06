-- ============================================================
-- Credenciales de prueba "serias" — Hotel Lilax
-- admin.lilax / Lilax2026!Admin
-- cajera.lilax / Lilax2026!Caja
-- (Cámbialas cuando quieras — solo pídeme el hash bcrypt nuevo)
-- ============================================================

-- Actualiza el admin existente (o créalo si por algún motivo no existe)
UPDATE users
   SET username = 'admin.lilax',
       password_hash = '$2b$10$/dTNsnq.eben.j0MeeonP.GFYffZFZU6NCqn4REmuVLCt/037ft22',
       full_name = 'Administrador Hotel Lilax'
 WHERE username = 'admin';

-- Nueva cajera "seria" (deja las cajera1/cajera2 de prueba tal cual, por si las usas)
INSERT INTO users (id, hotel_id, username, password_hash, full_name, role, active)
SELECT gen_random_uuid(), h.id, 'cajera.lilax',
       '$2b$10$8xPZCQirnMIOa2FCEfceme8oYhdDxjcKONCqOjYV./.1Cm8nW8noO',
       'Cajera Hotel Lilax', 'cajera', true
FROM hotels h WHERE h.slug = 'lilax'
ON CONFLICT (hotel_id, username) DO NOTHING;
