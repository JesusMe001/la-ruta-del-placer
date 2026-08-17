# Hotel Lilax — Backend (PMS + POS)

Piloto del sistema de gestión para La Ruta del Placer / Extasis, hotel Lilax.

## Stack
- Node.js + NestJS
- PostgreSQL + Prisma
- JWT para login de cajera/supervisor/admin
- Cron interno (`@nestjs/schedule`) para: (1) cobro automático de tiempo extra, (2) despacho de la cola de sincronización

## Arrancar en local

```bash
cp .env.example .env      # editar DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run start:dev
```

El archivo `lilax_schema.sql` (entregado aparte) contiene las funciones de negocio
(`fn_check_in`, `fn_add_product_to_rental`, `fn_check_out`, `fn_apply_auto_extensions`)
que Prisma invoca directamente vía `$queryRaw`. Aplícalo contra la base antes de migrar
con Prisma, o incorpóralo como una migración SQL manual (`prisma/migrations/.../migration.sql`).

## Flujo de negocio implementado

1. **Apertura de turno** → `POST /hotels/:hotelId/cash-sessions/open`
2. **Check-in** (cobra el precio base de 4h y ocupa la habitación) → `POST /rentals/check-in`
3. **Agregar consumo** (producto/minibar) → `POST /rentals/:id/products`
4. **Extensión automática de tiempo**: corre sola cada 5 minutos, no requiere acción del cajero.
   Si el huésped se pasa de las 4h, se genera el cargo del siguiente bloque automáticamente
   y la habitación pasa a estado `tiempo_extra`.
5. **Check-out** → `POST /rentals/:id/checkout`
6. **Cobro** (soporta pago mixto, se puede llamar varias veces) → `POST /rentals/:id/payments`
7. **Cierre de turno** → `POST /hotels/:hotelId/cash-sessions/:id/close`

Cada uno de estos eventos encola automáticamente un registro en `sync_outbox`,
que el `SyncService` despacha cada minuto hacia `CENTRAL_SYNC_URL`.

## Pendiente a definir con el equipo de La Ruta del Placer (sync)

Como acordaron dejar una ruta de red entre su servidor central y el servidor físico
de Lilax, falta definir con ellos:

1. **Contrato del endpoint receptor**: método (REST/webhook), formato del payload,
   autenticación (API key, mTLS, IP whitelist).
2. **Dirección del flujo**: ¿solo Lilax empuja hacia el central, o el central también
   necesita empujarnos datos (ej. cambios de precio, promociones, catálogo compartido)?
   Si es bidireccional, hay que agregar un endpoint receptor de nuestro lado
   (protegido con API key) — el esqueleto de eventos ya está listo en `sync_outbox`.
3. **Idempotencia**: recomiendo que su endpoint acepte el `entityId` como clave de
   deduplicación, para que reintentos no dupliquen registros del lado de ellos.
4. **Ventana de tolerancia a caídas**: mientras `CENTRAL_SYNC_URL` no esté configurado
   o esté caído, los eventos quedan en `pendiente` sin bloquear la operación de caja
   (la cajera nunca se entera si el sync central falla).

## QR de habitación

Cada habitación tiene un `qr_code` único generado al crearla. El QR físico apunta a:

```
https://lilax.larutadelplacer.ec/qr/<codigo>
```

Esa ruta es pública (sin login) y solo muestra el menú/servicios del hotel —
nunca datos de caja ni del alquiler en curso.

## Pendiente de construir

- Panel web de cajera (frontend) que consuma esta API.
- Reportes/dashboard para admin (ocupación, ventas por turno, diferencias de caja).
- Definir e implementar el contrato de sync una vez el equipo central lo entregue.
