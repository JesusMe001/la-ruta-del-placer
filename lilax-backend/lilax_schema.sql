-- ============================================================
-- HOTEL LILAX - Sistema de Gestión (PMS + POS)
-- Base de datos: PostgreSQL 14+
-- Piloto para La Ruta del Placer / Extasis
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
CREATE TYPE room_status AS ENUM (
    'libre',            -- disponible para alquilar
    'ocupada',          -- dentro de las 4h contratadas
    'tiempo_extra',      -- pasó el tiempo, se le cargó bloque adicional
    'limpieza',         -- liberada, pendiente de limpieza
    'fuera_servicio'    -- mantenimiento / bloqueada
);

CREATE TYPE rental_status AS ENUM (
    'activa',
    'tiempo_extra',
    'finalizada',
    'cancelada'
);

CREATE TYPE user_role AS ENUM (
    'cajera',
    'supervisor',
    'admin'
);

CREATE TYPE payment_method AS ENUM (
    'efectivo',
    'tarjeta',
    'transferencia',
    'mixto'
);

CREATE TYPE sync_status AS ENUM (
    'pendiente',
    'enviado',
    'error'
);

CREATE TYPE sync_entity AS ENUM (
    'rental',
    'rental_extension',
    'rental_product',
    'payment',
    'cash_session'
);

-- ------------------------------------------------------------
-- HOTELES (chain-ready: hoy Lilax, mañana los otros 13 puntos)
-- ------------------------------------------------------------
CREATE TABLE hotels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,          -- 'Hotel Lilax'
    slug            VARCHAR(50) UNIQUE NOT NULL,     -- 'lilax'  -> subdominio lilax.larutadelplacer.ec
    address         VARCHAR(255),
    phone           VARCHAR(30),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CATEGORÍAS DE HABITACIÓN Y PRECIOS
-- ------------------------------------------------------------
CREATE TABLE room_categories (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id            UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name                VARCHAR(80) NOT NULL,        -- 'Estándar', 'Suite Jacuzzi', 'VIP'
    description         TEXT,
    base_price_4h       NUMERIC(10,2) NOT NULL CHECK (base_price_4h >= 0),
    extra_block_price   NUMERIC(10,2) NOT NULL CHECK (extra_block_price >= 0), -- costo de cada bloque adicional de 4h
    extra_block_hours   SMALLINT NOT NULL DEFAULT 4,
    capacity            SMALLINT DEFAULT 2,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(hotel_id, name)
);

-- ------------------------------------------------------------
-- HABITACIONES (ligadas a un QR único)
-- ------------------------------------------------------------
CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES room_categories(id),
    number          VARCHAR(10) NOT NULL,           -- '101', 'A-5'
    floor           VARCHAR(10),
    qr_code         VARCHAR(64) UNIQUE NOT NULL,    -- token opaco embebido en el QR físico
    status          room_status NOT NULL DEFAULT 'libre',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(hotel_id, number)
);

CREATE INDEX idx_rooms_status ON rooms(hotel_id, status);
CREATE INDEX idx_rooms_qr ON rooms(qr_code);

-- ------------------------------------------------------------
-- USUARIOS DEL SISTEMA (cajeras, supervisores, admin)
-- ------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    username        VARCHAR(50) NOT NULL,
    password_hash   TEXT NOT NULL,                  -- bcrypt/argon2
    full_name       VARCHAR(120) NOT NULL,
    role            user_role NOT NULL DEFAULT 'cajera',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(hotel_id, username)
);

-- ------------------------------------------------------------
-- TURNOS DE CAJA (obliga a abrir turno antes de cobrar)
-- ------------------------------------------------------------
CREATE TABLE cash_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    cashier_id      UUID NOT NULL REFERENCES users(id),
    opening_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_amount  NUMERIC(10,2),
    expected_amount NUMERIC(10,2),                  -- calculado al cierre
    difference      NUMERIC(10,2),                  -- closing - expected
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'abierta' -- abierta / cerrada
);

CREATE INDEX idx_cash_sessions_open ON cash_sessions(hotel_id, status);

-- ------------------------------------------------------------
-- PRODUCTOS (minibar / consumo)
-- ------------------------------------------------------------
CREATE TABLE product_categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id    UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,               -- 'Bebidas', 'Snacks', 'Juguetes'
    UNIQUE(hotel_id, name)
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES product_categories(id),
    internal_code   VARCHAR(30) NOT NULL,           -- SKU interno
    name            VARCHAR(120) NOT NULL,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    cost            NUMERIC(10,2) DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(hotel_id, internal_code)
);

-- ------------------------------------------------------------
-- ALQUILERES (rentals) - el corazón del negocio
-- ------------------------------------------------------------
CREATE TABLE rentals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id            UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    room_id             UUID NOT NULL REFERENCES rooms(id),
    cashier_id          UUID NOT NULL REFERENCES users(id),
    cash_session_id     UUID NOT NULL REFERENCES cash_sessions(id),
    category_id         UUID NOT NULL REFERENCES room_categories(id), -- snapshot de categoría al momento del check-in
    base_price          NUMERIC(10,2) NOT NULL,      -- snapshot de precio (por si luego cambia la categoría)
    extra_block_price   NUMERIC(10,2) NOT NULL,
    extra_block_hours   SMALLINT NOT NULL DEFAULT 4,
    check_in            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_checkout   TIMESTAMPTZ NOT NULL,        -- check_in + 4h, se recalcula si se agrega bloque extra
    check_out           TIMESTAMPTZ,                 -- null mientras esté activa
    status              rental_status NOT NULL DEFAULT 'activa',
    extra_charges_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    products_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0, -- base + extra_charges + products, se recalcula
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rentals_status ON rentals(hotel_id, status);
CREATE INDEX idx_rentals_room_active ON rentals(room_id) WHERE status IN ('activa','tiempo_extra');
-- Regla de negocio: una habitación no puede tener 2 alquileres activos a la vez
CREATE UNIQUE INDEX uq_room_single_active_rental
    ON rentals(room_id)
    WHERE status IN ('activa','tiempo_extra');

-- ------------------------------------------------------------
-- EXTENSIONES DE TIEMPO (los bloques adicionales de 4h)
-- ------------------------------------------------------------
CREATE TABLE rental_extensions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id       UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    hours           SMALLINT NOT NULL DEFAULT 4,
    amount          NUMERIC(10,2) NOT NULL,
    auto_generated  BOOLEAN NOT NULL DEFAULT TRUE,  -- true = lo generó el job automático
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CONSUMO DE PRODUCTOS DENTRO DE UN ALQUILER
-- ------------------------------------------------------------
CREATE TABLE rental_products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id       UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL,          -- snapshot del precio al momento de la venta
    subtotal        NUMERIC(10,2) NOT NULL,
    added_by        UUID NOT NULL REFERENCES users(id),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PAGOS (un alquiler puede pagarse en más de una parte / método mixto)
-- ------------------------------------------------------------
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id       UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    cashier_id      UUID NOT NULL REFERENCES users(id),
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method          payment_method NOT NULL,
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- COLA DE SINCRONIZACIÓN (outbox pattern) HACIA EL SISTEMA CENTRAL
-- Cada evento relevante se encola aquí; un worker lo empuja
-- al sistema existente de La Ruta del Placer y marca el resultado.
-- ------------------------------------------------------------
CREATE TABLE sync_outbox (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    entity_type     sync_entity NOT NULL,
    entity_id       UUID NOT NULL,
    payload         JSONB NOT NULL,
    status          sync_status NOT NULL DEFAULT 'pendiente',
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_sync_outbox_pending ON sync_outbox(status) WHERE status = 'pendiente';

-- ============================================================
-- FUNCIONES / TRIGGERS DE LÓGICA DE NEGOCIO
-- ============================================================

-- Trigger genérico para updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rentals_updated_at BEFORE UPDATE ON rentals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- FUNCIÓN: check_in (abre un alquiler y ocupa la habitación)
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
    v_extra_hours SMALLINT;
    v_rental_id UUID;
BEGIN
    SELECT r.hotel_id, r.category_id, rc.base_price_4h, rc.extra_block_price, rc.extra_block_hours
      INTO v_hotel_id, v_category_id, v_base_price, v_extra_price, v_extra_hours
      FROM rooms r JOIN room_categories rc ON rc.id = r.category_id
      WHERE r.id = p_room_id AND r.status = 'libre'
      FOR UPDATE OF r;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La habitación no está libre o no existe';
    END IF;

    INSERT INTO rentals (hotel_id, room_id, cashier_id, cash_session_id, category_id,
                          base_price, extra_block_price, extra_block_hours,
                          check_in, expected_checkout, total_amount)
    VALUES (v_hotel_id, p_room_id, p_cashier_id, p_cash_session_id, v_category_id,
            v_base_price, v_extra_price, v_extra_hours,
            now(), now() + make_interval(hours => v_extra_hours), v_base_price)
    RETURNING id INTO v_rental_id;

    UPDATE rooms SET status = 'ocupada' WHERE id = p_room_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental', v_rental_id,
            jsonb_build_object('event','check_in','rental_id', v_rental_id, 'room_id', p_room_id));

    RETURN v_rental_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- JOB AUTOMÁTICO: corre cada X minutos (via cron / pg_cron / worker)
-- Busca alquileres activos que ya pasaron su expected_checkout
-- y les agrega automáticamente un bloque adicional de cobro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_apply_auto_extensions() RETURNS INTEGER AS $$
DECLARE
    v_rental RECORD;
    v_count INTEGER := 0;
BEGIN
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

-- ------------------------------------------------------------
-- FUNCIÓN: agregar producto/consumo a un alquiler activo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_add_product_to_rental(
    p_rental_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_cashier_id UUID
) RETURNS UUID AS $$
DECLARE
    v_price NUMERIC(10,2);
    v_subtotal NUMERIC(10,2);
    v_item_id UUID;
    v_hotel_id UUID;
BEGIN
    SELECT price, hotel_id INTO v_price, v_hotel_id FROM products WHERE id = p_product_id AND active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    v_subtotal := v_price * p_quantity;

    INSERT INTO rental_products (rental_id, product_id, quantity, unit_price, subtotal, added_by)
    VALUES (p_rental_id, p_product_id, p_quantity, v_price, v_subtotal, p_cashier_id)
    RETURNING id INTO v_item_id;

    UPDATE rentals
       SET products_total = products_total + v_subtotal,
           total_amount = total_amount + v_subtotal
     WHERE id = p_rental_id;

    UPDATE products SET stock = stock - p_quantity WHERE id = p_product_id;

    INSERT INTO sync_outbox (hotel_id, entity_type, entity_id, payload)
    VALUES (v_hotel_id, 'rental_product', v_item_id,
            jsonb_build_object('event','product_added','rental_id', p_rental_id,
                                'product_id', p_product_id, 'quantity', p_quantity, 'subtotal', v_subtotal));

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- FUNCIÓN: check_out (cierra el alquiler, libera la habitación)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_out(
    p_rental_id UUID,
    p_cashier_id UUID
) RETURNS VOID AS $$
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
END;
$$ LANGUAGE plpgsql;
