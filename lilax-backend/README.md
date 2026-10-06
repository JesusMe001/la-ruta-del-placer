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

## Integración con Informix (sistema existente)

El módulo `src/informix/` conecta de solo lectura al ERP Informix real (sucursal
924 = Hotel Lilax) para poder cruzar habitaciones, menú y último huésped registrado,
y llenar los campos `legacy_cod_*` que ya existen en el schema.

**Importante sobre el ambiente**: `ol_punto15` (IP interna de la empresa, base `externo`)
es un **servidor de pruebas** que la empresa habilitó específicamente para este
desarrollo — no es el servidor de producción real, y todavía no hay acceso
confirmado a uno. Los datos que trae (habitaciones, tarifas, huéspedes) son
reales del negocio (no inventados), pero viven en una copia dedicada a pruebas.
Esto es en realidad una ventaja mientras se desarrolla: se puede correr
`import-rooms` y cualquier otra operación de escritura contra este servidor
sin riesgo de tocar datos de huéspedes reales en curso. Cuando la empresa dé
acceso al servidor productivo, solo hay que cambiar las variables `INFORMIX_*`
del `.env` — el código no necesita ningún cambio.

**Confirmado (19/09/2026): sí se puede modificar la estructura de este servidor
de pruebas** (agregar tablas o columnas propias), no es de solo lectura a nivel
de permisos. Por ahora el módulo se mantiene deliberadamente de solo lectura
hacia las tablas del ERP existente (`saehabi`, `saeprod`, `saeppr`, `saetiha`,
`tb_regced`, etc.) — no se escribe nada ahí, siguiendo el principio de no
acoplar este sistema nuevo al legacy. Este permiso de modificar sí deja abierta
la puerta, si hace falta más adelante, a por ejemplo:
- Una tabla propia dentro de Informix para llevar auditoría/log de la
  integración (qué se sincronizó y cuándo).
- Escribir de vuelta el estado de la habitación hacia `habi_est_habi` cuando
  se haga check-in/check-out desde este sistema (hoy es un cruce unidireccional:
  solo se lee de Informix hacia Postgres).

Nada de esto está construido todavía — se documenta aquí para no perder el
permiso de vista, y se decide cuándo/si conviene usarlo según lo que pida
el negocio más adelante.

**Esto NO funciona "solo con código"** — hay un paso manual insalvable:

1. El **IBM Informix Client SDK para Linux** hay que descargarlo con una cuenta
   de IBM (gratis para uso como cliente) y no se puede incluir en este repo ni
   en la imagen Docker por licencia. Se instala aparte en el servidor real
   (`./installclientsdk`, definiendo `INFORMIXDIR`).
2. Sin ese SDK instalado, el módulo simplemente reporta `configured: false` en
   `GET /hotels/:hotelId/informix/status` — no rompe el resto del sistema.
3. La conexión real y **ya probada** (no la de `ol_serverweb`, que sigue sin
   confirmar) es: `Host=<IP del servidor de pruebas>`, `Server=ol_punto15`, `Service=1545`,
   `Protocol=onsoctcp`, `Database=externo` — usuario `externo`.
4. Esa IP solo responde desde la red de la empresa: este servidor solo va a
   poder conectarse ahí si corre dentro de esa misma red, o con una VPN que
   la alcance. No se puede probar desde cualquier lugar.

Endpoints (solo admin/supervisor):
- `GET /hotels/:hotelId/informix/status` — si está configurado y listo.
- `GET /hotels/:hotelId/informix/test` — prueba de conectividad mínima.
- `GET /hotels/:hotelId/informix/rooms?sucursal=924` — habitaciones reales del ERP
  (excluye las 10 "cuentas" contables internas mezcladas en saehabi: CORTESIA,
  FACT, RECARGOS, GIFT CARD, RESERVA, etc. — todas con habi_cod_tiha=1124).
- `GET /hotels/:hotelId/informix/menu?bodega=3&sucursal=924` — catálogo real
  (bodega `3` confirmada como la de consumo/room-service para Lilax).
- `GET /hotels/:hotelId/informix/guest?habitacion=101` — último huésped
  registrado en esa habitación (no confirma si sigue hospedado).
- `POST /hotels/:hotelId/informix/import-rooms` — trae las 48 habitaciones
  físicas reales + sus tarifas de `saetiha`, y crea/actualiza las categorías
  y habitaciones locales con esos datos reales.
- `POST /hotels/:hotelId/informix/push-rooms` — **al revés**: sube el hotel,
  las categorías y las habitaciones de nuestro Postgres hacia
  `lilax_hotels`/`lilax_room_categories`/`lilax_rooms` en Informix, usando
  los mismos UUID. Hay que correrlo **una vez, antes** de que el espejo de
  pedidos en tiempo real funcione (si no, el pedido intenta referenciar una
  habitación que Informix todavía no conoce).
- `POST /hotels/:hotelId/informix/push-products` — igual, pero para el
  catálogo de productos (`lilax_products`).

### Pedidos en tiempo real (Postgres → Informix)

Cada vez que un huésped pide algo por QR (o la cajera agrega un consumo, o
se da una cortesía), el pedido se escribe primero en nuestro Postgres (como
siempre) y **al mismo tiempo** se refleja en `lilax_rentals`/
`lilax_rental_products` de Informix — para que el sistema de ellos lo vea al
instante y dispare su propia alerta de "llevar producto a la habitación".

Puntos importantes:
- Es **best-effort**: si Informix no está alcanzable en ese momento (típico
  mientras no haya VPN/CSDK resuelto), el pedido en Postgres se guarda
  normal igual — solo se registra una advertencia en el log del backend.
  Nunca se le muestra un error al huésped por esto.
- Requiere haber corrido `push-rooms` y `push-products` al menos una vez
  (para que las referencias de habitación/producto ya existan del lado de
  Informix).
- No hay reintento automático todavía si un pedido puntual falla de
  reflejar — si hace falta eso más adelante (para no perder ningún pedido
  aunque Informix esté caído un rato), se puede usar la tabla `sync_outbox`
  que ya existe para ese propósito.

### Esquema espejo dentro de Informix (`lilax_*`)

Confirmado (19/09/2026): el servidor de pruebas permite modificar su
estructura. Se creó un espejo completo de nuestro schema de Postgres como
tablas nuevas dentro de Informix, con prefijo `lilax_` para no chocar con
las tablas reales del ERP — están **vacías**, listas para cuando haya datos
reales, no se subió nada de prueba todavía.

Archivos de apoyo (NO están en el repo: viven solo en la PC de desarrollo con acceso a la red de la empresa):
- `informix-schema-lilax.sql` — el DDL completo (14 tablas, un espejo de
  cada modelo de `prisma/schema.prisma` excepto `SyncOutbox`, que se dejó
  fuera por ser un detalle interno de Postgres y por depender de un tipo
  JSON que Informix clásico no soporta bien).
- `crear-tablas-informix.ps1` — lo ejecuta contra el DSN `HOTELES`, tabla
  por tabla, tolerando "ya existe" para poder re-correrlo sin romper nada:
  ```powershell
  .\crear-tablas-informix.ps1
  ```

Dónde queda cada cosa que ya existe en el ERP vs. lo que es solo nuestro:
- `lilax_rooms`, `lilax_room_categories`, `lilax_products`: tienen columna
  `legacy_cod_*` apuntando al registro real (`saehabi`, `saetiha`,
  `saeprod`) — son un espejo/caché, no la fuente de verdad.
- `lilax_rentals`, `lilax_rental_products`, `lilax_payments`,
  `lilax_cash_sessions`, `lilax_users`, etc.: no tienen equivalente en el
  ERP — son conceptos propios de este sistema (check-in por QR, bloques de
  tiempo extra, cortesías, limpieza). Estas quedan vacías hasta que este
  sistema esté en producción real generando datos.
