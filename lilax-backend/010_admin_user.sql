-- ============================================================
-- MIGRACIÓN v9 - Hotel Lilax
-- Crea el primer usuario administrador. Solo un admin puede crear
-- cajeras desde el panel, así que necesitamos sembrar el primero
-- directo en la base de datos.
--
-- Usuario:    admin
-- Contraseña: admin1234   (cámbiala apenas puedas iniciar sesión)
--
-- Usa pgcrypto (ya estaba habilitado) para generar el hash bcrypt
-- directo en SQL, sin depender de node/bcrypt en la terminal.
-- ============================================================

INSERT INTO users (id, hotel_id, username, password_hash, full_name, role, active, created_at)
VALUES (
    gen_random_uuid(),
    '44a065fb-6dd0-490f-a1db-755eca13a959',
    'admin',
    crypt('admin1234', gen_salt('bf')),
    'Administrador',
    'admin',
    true,
    now()
)
ON CONFLICT DO NOTHING;
