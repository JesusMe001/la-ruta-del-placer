import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as odbc from 'odbc';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Sucursal confirmada por exploración de datos reales: 924 = Hotel Lilax.
const DEFAULT_SUCURSAL = 924;

// El driver ODBC de Informix a veces entrega los textos (nombres de
// producto, categorías, etc.) codificados en Windows-1252/Latin-1 en vez de
// UTF-8 — eso hace que "ñ", tildes, "¿", "¡" salgan como "Ã±", "Ã³", etc. en
// vez del caracter real. Esto repara ese caso concreto (el más común) sin
// tocar strings que ya vienen bien en UTF-8.
function fixMojibake(value: string): string {
  if (!value || !/[ÃÂ]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    // Si la "reparación" mete el caracter de reemplazo (bytes inválidos),
    // es que el string original no era el patrón esperado — se deja tal cual.
    return repaired.includes('�') ? value : repaired;
  } catch {
    return value;
  }
}

function fixMojibakeDeep<T>(row: T): T {
  if (row == null || typeof row !== 'object') return row;
  const out: any = Array.isArray(row) ? [] : {};
  for (const [key, val] of Object.entries(row as any)) {
    out[key] = typeof val === 'string' ? fixMojibake(val) : val;
  }
  return out;
}

interface InformixEnv {
  enabled: boolean;
  connectionString: string | null;
  missing: string[];
}

function readEnv(): InformixEnv {
  const enabled = (process.env.INFORMIX_ENABLED ?? 'false').toLowerCase() === 'true';
  const dsn = process.env.INFORMIX_DSN;
  const uid = process.env.INFORMIX_UID;
  const pwd = process.env.INFORMIX_PWD;
  const missing: string[] = [];
  let connectionString: string | null = null;

  if (dsn) {
    // Opción A: usar un DSN ya registrado (en Windows o en /etc/odbc.ini).
    // UID/PWD son OPCIONALES aquí a propósito: si el DSN ya tiene la
    // contraseña guardada (como pasa con "HOTELES" en Windows), mandar un
    // UID/PWD explícito puede pisar esa credencial guardada y romper la
    // conexión con un "incorrect password" aunque la real esté bien.
    connectionString = uid && pwd ? `DSN=${dsn};UID=${uid};PWD=${pwd};` : `DSN=${dsn};`;
  } else {
    // Opción B: conexión directa, sin depender de /etc/odbc.ini (más simple de desplegar).
    const host = process.env.INFORMIX_HOST;
    const service = process.env.INFORMIX_SERVICE || '1545';
    const server = process.env.INFORMIX_SERVER;
    const database = process.env.INFORMIX_DATABASE;
    const protocol = process.env.INFORMIX_PROTOCOL || 'onsoctcp';
    // Ruta al .so del driver dentro del IBM Informix Client SDK ya instalado
    // en el servidor (ver INFORMIXDIR). No se puede empaquetar en la imagen
    // porque es un binario con licencia de IBM, hay que instalarlo aparte.
    const driverPath = process.env.INFORMIX_DRIVER_PATH || '/opt/IBM/informix/lib/cli/iclit09b.so';

    if (!host) missing.push('INFORMIX_HOST');
    if (!server) missing.push('INFORMIX_SERVER');
    if (!database) missing.push('INFORMIX_DATABASE');
    if (!uid) missing.push('INFORMIX_UID');
    if (!pwd) missing.push('INFORMIX_PWD');

    if (missing.length === 0) {
      connectionString =
        `Driver=${driverPath};Host=${host};Service=${service};` +
        `Server=${server};Database=${database};Protocol=${protocol};UID=${uid};PWD=${pwd};`;
    }
  }

  return { enabled, connectionString, missing };
}

@Injectable()
export class InformixService {
  private readonly logger = new Logger(InformixService.name);
  private pool: any = null;

  constructor(private prisma: PrismaService) {}

  status() {
    const env = readEnv();
    return {
      enabled: env.enabled,
      configured: env.enabled && !!env.connectionString,
      missing: env.missing,
    };
  }

  private async getPool() {
    const env = readEnv();
    if (!env.enabled || !env.connectionString) {
      throw new Error(
        'La conexión a Informix no está configurada. Revisa las variables INFORMIX_* en el .env ' +
          '(y que el IBM Informix Client SDK para Linux esté instalado en este servidor).',
      );
    }
    if (!this.pool) {
      // Si el saneo de "Ã±" no alcanza (p. ej. el driver ya perdió el byte y
      // muestra "?" en vez de la letra), se puede forzar el locale GLS que
      // usa el cliente Informix con estas dos variables opcionales en el
      // .env — normalmente coinciden con el locale real del servidor
      // (típico en instalaciones de LatAm: es_es.CP1252 o es_es.8859-1).
      // Si no se definen, no se toca nada (comportamiento actual intacto).
      if (process.env.INFORMIX_CLIENT_LOCALE) {
        process.env.CLIENT_LOCALE = process.env.INFORMIX_CLIENT_LOCALE;
      }
      if (process.env.INFORMIX_DB_LOCALE) {
        process.env.DB_LOCALE = process.env.INFORMIX_DB_LOCALE;
      }
      try {
        this.pool = await (odbc as any).pool({
          connectionString: env.connectionString,
          initialSize: 1,
          incrementSize: 1,
          maxSize: 5,
          shrink: true,
        });
      } catch (err: any) {
        const detail = this.describeOdbcError(err);
        this.logger.error(`No se pudo abrir el pool de conexión a Informix: ${detail}`);
        throw new InternalServerErrorException(`Error conectando a Informix: ${detail}`);
      }
    }
    return this.pool;
  }

  // El paquete "odbc" casi nunca pone el motivo real en err.message (siempre
  // dice algo genérico como "[odbc] Error connecting to the database") — el
  // detalle de verdad (usuario/contraseña, driver no encontrado, red, etc.)
  // viene en err.odbcErrors, un arreglo con lo que reportó el driver.
  private describeOdbcError(err: any): string {
    if (Array.isArray(err?.odbcErrors) && err.odbcErrors.length > 0) {
      return err.odbcErrors
        .map((e: any) => `[${e.state ?? '?'}] ${e.message ?? JSON.stringify(e)}`)
        .join(' | ');
    }
    return err?.message || String(err);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = await this.getPool();
    let connection;
    try {
      connection = await pool.connect();
    } catch (err: any) {
      const detail = this.describeOdbcError(err);
      this.logger.error(`No se pudo abrir conexión desde el pool: ${detail}`);
      throw new InternalServerErrorException(`Error conectando a Informix: ${detail}`);
    }
    try {
      const rows = (await connection.query(sql, params)) as T[];
      return rows.map((r) => fixMojibakeDeep(r));
    } catch (err: any) {
      const detail = this.describeOdbcError(err);
      this.logger.error(`Error ejecutando consulta en Informix: ${detail} — SQL: ${sql}`);
      throw new InternalServerErrorException(`Error consultando Informix: ${detail}`);
    } finally {
      await connection.close();
    }
  }

  // Prueba mínima de conectividad, sin depender de conocer ninguna tabla de negocio.
  async testConnection() {
    const rows = await this.query<{ version: string }>(
      `SELECT FIRST 1 DBINFO('version','full') AS version FROM systables`,
    );
    return rows[0] ?? null;
  }

  // Habitaciones reales del ERP para una sucursal (924 = Lilax por defecto).
  // OJO: saehabi mezcla habitaciones físicas con "cuentas" contables internas
  // (CORTESIA CLIENTES, FACT CLIENTE, RECARGOS, GIFT CARD, RESERVA, etc.) —
  // todas esas comparten habi_cod_tiha = 1124, por eso se excluyen aquí.
  // Confirmado con datos reales: 58 filas totales en sucursal 924, de las
  // cuales 48 son habitaciones físicas y 10 son esas cuentas virtuales.
  async listRoomsRaw(codSucursal: number = DEFAULT_SUCURSAL) {
    return this.query(
      `SELECT habi_cod_habi, habi_nom_habi, habi_cod_tiha, habi_est_habi, habi_cod_char
       FROM saehabi
       WHERE habi_cod_sucu = ? AND habi_cod_tiha <> 1124
       ORDER BY habi_nom_habi`,
      [codSucursal],
    );
  }

  // Menú/catálogo real. codBodega hay que confirmarlo con el administrador
  // del ERP (cuál bodega corresponde a consumo de habitación / room-service).
  async listMenuRaw(codBodega: number, codSucursal: number = DEFAULT_SUCURSAL) {
    return this.query(
      `SELECT p.prod_cod_prod AS codigo, p.prod_nom_prod AS nombre,
              c.cate_nom_cate AS categoria, pr.ppr_pre_raun AS precio
       FROM saeprod p
       JOIN saecate c ON c.cate_cod_cate = p.prod_cod_cate
       JOIN saeppr pr ON pr.ppr_cod_prod = p.prod_cod_prod
                      AND pr.ppr_cod_sucu = p.prod_cod_sucu
                      AND pr.ppr_cod_bode = ?
       WHERE p.prod_cod_sucu = ?
       ORDER BY c.cate_nom_cate, p.prod_nom_prod`,
      [codBodega, codSucursal],
    );
  }

  // Último huésped registrado en esa habitación — "mejor esfuerzo", NO indica
  // si sigue hospedado ahora (tb_regced.regced_estado está siempre NULL).
  async lastGuestForRoom(numeroHabitacion: string, codSucursal: number = DEFAULT_SUCURSAL) {
    const rows = await this.query(
      `SELECT FIRST 1 regced_nombre, regced_apelli, regced_cedula, regced_fecreg, regced_horreg
       FROM tb_regced
       WHERE regced_sucurs = ? AND regced_habita = ?
       ORDER BY regced_regced DESC`,
      [codSucursal, numeroHabitacion],
    );
    return rows[0] ?? null;
  }

  // Tarifas reales por tipo de habitación (saetiha), confirmadas para Lilax:
  // base = 5h (tiha_cos_maxi), recargo = 4h (tiha_cos_extr, ~mitad del base).
  async listRoomTariffsRaw(codSucursal: number = DEFAULT_SUCURSAL) {
    return this.query(
      `SELECT tiha_cod_tiha, tiha_nom_tiha, tiha_cos_maxi, tiha_cos_extr
       FROM saetiha
       WHERE tiha_cod_sucu = ?`,
      [codSucursal],
    );
  }

  // Nombre de categoría según el tipo de habitación real del ERP.
  // Confirmado con datos reales de Lilax: 1099 = estándar, 1174 = suite,
  // 1369 = doble. Si aparece un tipo nuevo no visto todavía, se usa
  // "Estándar" por defecto y hay que revisarlo a mano después.
  private categoryNameForTiha(codTiha: number): string {
    const map: Record<number, string> = {
      1099: 'Estándar',
      1174: 'Suite',
      1369: 'Doble',
    };
    return map[codTiha] || 'Estándar';
  }

  // Importa las habitaciones REALES del ERP como fuente de verdad, en vez de
  // intentar cruzar contra habitaciones inventadas de prueba (que no
  // coinciden con la numeración real: aquí no hay "201"/"202", hay
  // "HABITACION 101".."340" y "SUITE 1".."8" con código M1-M8).
  // Usa habi_cod_char (el código corto real, ej. "101", "217", "M1") como
  // número de habitación local, y guarda habi_cod_habi en legacy_cod_habi.
  // El precio de cada categoría se toma de saetiha (tarifa real) — si algún
  // tipo no aparece ahí, se deja $25/5h como respaldo y hay que revisarlo.
  async importRealRooms(hotelId: string, codSucursal: number = DEFAULT_SUCURSAL) {
    const [informixRooms, tariffs] = await Promise.all([
      this.listRoomsRaw(codSucursal),
      this.listRoomTariffsRaw(codSucursal),
    ]);

    const tariffByTiha = new Map<number, any>();
    for (const t of tariffs as any[]) {
      tariffByTiha.set(Number(t.tiha_cod_tiha), t);
    }

    const categoryCache = new Map<string, string>(); // nombre -> id local
    const created: string[] = [];
    const updated: string[] = [];

    for (const r of informixRooms as any[]) {
      const number = String(r.habi_cod_char || r.habi_nom_habi).trim();
      const legacyCodHabi = Number(r.habi_cod_habi);
      const codTiha = Number(r.habi_cod_tiha);
      const categoryName = this.categoryNameForTiha(codTiha);
      const tariff = tariffByTiha.get(codTiha);

      let categoryId = categoryCache.get(categoryName);
      if (!categoryId) {
        let category = await this.prisma.roomCategory.findFirst({
          where: { hotelId, name: categoryName },
        });
        if (!category) {
          const basePrice4h = tariff ? Number(tariff.tiha_cos_maxi) : 25;
          const extraBlockPrice = tariff ? Number(tariff.tiha_cos_extr) : Math.round((basePrice4h / 2) * 100) / 100;
          category = await this.prisma.roomCategory.create({
            data: {
              hotelId,
              name: categoryName,
              basePrice4h,
              extraBlockPrice,
              baseHours: 5,
              extraBlockHours: 4,
              legacyCodTiha: codTiha,
            },
          });
        }
        categoryId = category.id;
        categoryCache.set(categoryName, categoryId);
      }

      const existing = await this.prisma.room.findFirst({ where: { hotelId, number } });
      if (existing) {
        await this.prisma.room.update({
          where: { id: existing.id },
          data: { legacyCodHabi, categoryId },
        });
        updated.push(number);
      } else {
        await this.prisma.room.create({
          data: {
            hotelId,
            categoryId,
            number,
            qrCode: `qr-lilax-${number}-${randomBytes(2).toString('hex')}`,
            legacyCodHabi,
          },
        });
        created.push(number);
      }
    }

    return {
      totalInformixRooms: informixRooms.length,
      created,
      updated,
      note: 'Precios tomados de saetiha (tarifa real por tipo de habitación). Si algún tipo no tenía tarifa en Informix, quedó en $25/5h de respaldo — revísalo en Admin → Habitaciones/Categorías.',
    };
  }

  // Asegura (o crea) una categoría de producto real por nombre, cacheando
  // por nombre dentro de una misma importación para no golpear la DB de más.
  private async ensureProductCategory(
    hotelId: string,
    name: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const key = (name || 'Sin categoría').trim();
    const cached = cache.get(key);
    if (cached) return cached;
    let category = await this.prisma.productCategory.findFirst({ where: { hotelId, name: key } });
    if (!category) {
      category = await this.prisma.productCategory.create({ data: { hotelId, name: key } });
    }
    cache.set(key, category.id);
    return category.id;
  }

  // Importa el catálogo REAL de productos (saeprod + saecate + saeppr) para
  // una sucursal/bodega, igual que importRealRooms hizo con las habitaciones.
  // Confirmado con datos reales: bodega 3 = consumo/room-service en
  // sucursal 924 (Lilax). Empareja por legacy_cod_prod si ya existe; si no,
  // intenta adoptar un producto de PRUEBA con el mismo nombre exacto (para
  // no duplicar el menú de prueba que ya estaba cargado); si tampoco hay
  // coincidencia, crea el producto nuevo.
  async importRealProducts(
    hotelId: string,
    codBodega: number = 3,
    codSucursal: number = DEFAULT_SUCURSAL,
  ) {
    const rows = await this.listMenuRaw(codBodega, codSucursal);
    const categoryCache = new Map<string, string>();
    const created: string[] = [];
    const updated: string[] = [];
    const skipped: { codigo: string; razon: string }[] = [];

    for (const r of rows as any[]) {
      const codigo = r.codigo != null ? String(r.codigo).trim() : '';
      const nombre = r.nombre != null ? String(r.nombre).trim() : '';
      const categoriaNombre = r.categoria != null ? String(r.categoria).trim() : 'Sin categoría';
      const precio = Number(r.precio);

      if (!codigo || !nombre || !isFinite(precio)) {
        skipped.push({ codigo: codigo || '(sin código)', razon: 'Fila incompleta en Informix' });
        continue;
      }

      const categoryId = await this.ensureProductCategory(hotelId, categoriaNombre, categoryCache);

      let product = await this.prisma.product.findFirst({ where: { hotelId, legacyCodProd: codigo } });
      if (!product) {
        product = await this.prisma.product.findFirst({
          where: { hotelId, legacyCodProd: null, name: { equals: nombre, mode: 'insensitive' } },
        });
      }

      if (product) {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { name: nombre, price: precio, categoryId, legacyCodProd: codigo, active: true },
        });
        updated.push(codigo);
      } else {
        await this.prisma.product.create({
          data: {
            hotelId,
            categoryId,
            internalCode: codigo,
            legacyCodProd: codigo,
            name: nombre,
            price: precio,
            stock: 0,
          },
        });
        created.push(codigo);
      }
    }

    return {
      totalInformixProducts: rows.length,
      created,
      updated,
      skipped,
      note:
        'Productos traídos de saeprod+saecate+saeppr (por defecto sucursal 924, bodega 3). ' +
        'Se emparejaron por legacy_cod_prod, o por nombre exacto si ya existía un producto de prueba sin código real.',
    };
  }

  // Escritura genérica (INSERT/UPDATE) contra las tablas lilax_* que
  // nosotros mismos creamos en Informix. Nunca se usa contra tablas del
  // ERP existente (saehabi, saeprod, etc.) — esas son de solo lectura.
  async execute(sql: string, params: any[] = []): Promise<void> {
    await this.query(sql, params);
  }

  // ---------- Paso 1: espejo Postgres → Informix (hotel/categorías/habitaciones) ----------
  // Necesario ANTES de poder reflejar pedidos, porque lilax_rentals.room_id
  // referencia lilax_rooms(id) — hay que sembrar esa tabla con los MISMOS
  // ids (UUID) que ya tiene nuestro Postgres, para que las referencias calcen.
  async pushRoomsToInformix(hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new Error('Hotel no encontrado');

    const hotelExists = await this.query(`SELECT id FROM lilax_hotels WHERE id = ?`, [hotel.id]);
    if (hotelExists.length === 0) {
      await this.execute(
        `INSERT INTO lilax_hotels (id, name, slug, address, phone, legacy_cod_empr, legacy_cod_sucu, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 't')`,
        [hotel.id, hotel.name, hotel.slug, hotel.address, hotel.phone, hotel.legacyCodEmpr, hotel.legacyCodSucu],
      );
    } else {
      await this.execute(
        `UPDATE lilax_hotels SET name=?, slug=?, address=?, phone=?, legacy_cod_empr=?, legacy_cod_sucu=? WHERE id=?`,
        [hotel.name, hotel.slug, hotel.address, hotel.phone, hotel.legacyCodEmpr, hotel.legacyCodSucu, hotel.id],
      );
    }

    const categories = await this.prisma.roomCategory.findMany({ where: { hotelId } });
    let categoriesPushed = 0;
    for (const c of categories) {
      const exists = await this.query(`SELECT id FROM lilax_room_categories WHERE id = ?`, [c.id]);
      if (exists.length === 0) {
        await this.execute(
          `INSERT INTO lilax_room_categories
             (id, hotel_id, name, description, base_price_4h, extra_block_price, base_hours, extra_block_hours, legacy_cod_tiha, capacity, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 't')`,
          [c.id, c.hotelId, c.name, c.description, Number(c.basePrice4h), Number(c.extraBlockPrice), c.baseHours, c.extraBlockHours, c.legacyCodTiha, c.capacity],
        );
      } else {
        await this.execute(
          `UPDATE lilax_room_categories SET name=?, base_price_4h=?, extra_block_price=?, legacy_cod_tiha=? WHERE id=?`,
          [c.name, Number(c.basePrice4h), Number(c.extraBlockPrice), c.legacyCodTiha, c.id],
        );
      }
      categoriesPushed++;
    }

    const rooms = await this.prisma.room.findMany({ where: { hotelId } });
    let roomsPushed = 0;
    for (const r of rooms) {
      const exists = await this.query(`SELECT id FROM lilax_rooms WHERE id = ?`, [r.id]);
      if (exists.length === 0) {
        await this.execute(
          `INSERT INTO lilax_rooms (id, hotel_id, category_id, number, floor, qr_code, legacy_cod_habi, status, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 't')`,
          [r.id, r.hotelId, r.categoryId, r.number, r.floor, r.qrCode, r.legacyCodHabi, r.status],
        );
      } else {
        await this.execute(
          `UPDATE lilax_rooms SET category_id=?, status=?, legacy_cod_habi=? WHERE id=?`,
          [r.categoryId, r.status, r.legacyCodHabi, r.id],
        );
      }
      roomsPushed++;
    }

    return { categoriesPushed, roomsPushed };
  }

  // Espejo Postgres → Informix de productos (para que lilax_rental_products
  // pueda referenciar lilax_products con los mismos ids).
  async pushProductsToInformix(hotelId: string) {
    const products = await this.prisma.product.findMany({ where: { hotelId } });
    let pushed = 0;
    for (const p of products) {
      const exists = await this.query(`SELECT id FROM lilax_products WHERE id = ?`, [p.id]);
      if (exists.length === 0) {
        await this.execute(
          `INSERT INTO lilax_products (id, hotel_id, category_id, internal_code, legacy_cod_prod, name, image_url, price, cost, stock, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 't')`,
          [p.id, p.hotelId, p.categoryId, p.internalCode, p.legacyCodProd, p.name, p.imageUrl, Number(p.price), Number(p.cost ?? 0), p.stock],
        );
      } else {
        await this.execute(`UPDATE lilax_products SET price=?, stock=? WHERE id=?`, [Number(p.price), p.stock, p.id]);
      }
      pushed++;
    }
    return { pushed };
  }

  // ---------- Paso 2: pedido en tiempo real (Postgres → Informix) ----------
  // Se llama justo después de guardar el pedido en nuestro Postgres, para
  // que el sistema de ellos lo vea al instante y dispare su propia alerta
  // de "llevar producto a la habitación". Si Informix no está alcanzable en
  // ese momento, NO debe romper el pedido del huésped — solo se registra
  // el error en el log y sigue.
  async mirrorRentalRealtime(rental: {
    id: string; hotelId: string; roomId: string; cashierId: string; cashSessionId: string;
    categoryId: string; basePrice: any; extraBlockPrice: any; baseHours: number; extraBlockHours: number;
    checkIn: Date; expectedCheckout: Date; status: string; extraChargesTotal: any; productsTotal: any; totalAmount: any;
  }) {
    try {
      const exists = await this.query(`SELECT id FROM lilax_rentals WHERE id = ?`, [rental.id]);
      if (exists.length === 0) {
        await this.execute(
          `INSERT INTO lilax_rentals
             (id, hotel_id, room_id, cashier_id, cash_session_id, category_id, base_price, extra_block_price,
              base_hours, extra_block_hours, check_in, expected_checkout, status, extra_charges_total, products_total, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rental.id, rental.hotelId, rental.roomId, rental.cashierId, rental.cashSessionId, rental.categoryId,
           Number(rental.basePrice), Number(rental.extraBlockPrice), rental.baseHours, rental.extraBlockHours,
           rental.checkIn, rental.expectedCheckout, rental.status,
           Number(rental.extraChargesTotal), Number(rental.productsTotal), Number(rental.totalAmount)],
        );
      } else {
        await this.execute(
          `UPDATE lilax_rentals SET status=?, extra_charges_total=?, products_total=?, total_amount=?, updated_at=CURRENT YEAR TO FRACTION(3) WHERE id=?`,
          [rental.status, Number(rental.extraChargesTotal), Number(rental.productsTotal), Number(rental.totalAmount), rental.id],
        );
      }
    } catch (err: any) {
      this.logger.warn(`No se pudo reflejar el alquiler ${rental.id} en Informix: ${err.message}`);
    }
  }

  async mirrorRentalProductRealtime(item: {
    id: string; rentalId: string; productId: string; quantity: number; unitPrice: any; subtotal: any;
    addedBy: string | null; delivered: boolean; note: string | null;
  }) {
    try {
      await this.execute(
        `INSERT INTO lilax_rental_products (id, rental_id, product_id, quantity, unit_price, subtotal, added_by, delivered, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.rentalId, item.productId, item.quantity, Number(item.unitPrice), Number(item.subtotal),
         item.addedBy, item.delivered ? 't' : 'f', item.note],
      );
    } catch (err: any) {
      this.logger.warn(`No se pudo reflejar el pedido ${item.id} en Informix (esto es lo que dispara su alerta de entrega — revisar): ${err.message}`);
    }
  }
}
