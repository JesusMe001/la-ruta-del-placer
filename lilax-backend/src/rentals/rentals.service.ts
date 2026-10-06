import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InformixService } from '../informix/informix.service';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService, private informixService: InformixService) {}

  // Manda a Informix el estado actual del alquiler (best-effort: si falla,
  // solo se registra en el log, nunca rompe la operación real en Postgres).
  private async mirrorRental(rentalId: string) {
    const rental = await this.getRentalDetail(rentalId);
    if (rental) await this.informixService.mirrorRentalRealtime(rental as any);
    return rental;
  }

  // Abre un alquiler: cobra el precio base de 4h y ocupa la habitación.
  async checkIn(roomId: string, cashierId: string, cashSessionId: string) {
    const rows = await this.prisma.$queryRaw<{ fn_check_in: string }[]>`
      SELECT fn_check_in(${roomId}::uuid, ${cashierId}::uuid, ${cashSessionId}::uuid)
    `;
    const rentalId = rows[0].fn_check_in;
    return this.mirrorRental(rentalId);
  }

  // Agrega un producto (minibar/consumo) al alquiler activo. Esto es lo que
  // dispara la alerta de entrega en el sistema de ellos, por eso se refleja
  // el ítem específico en lilax_rental_products en tiempo real.
  async addProduct(rentalId: string, productId: string, quantity: number, cashierId: string) {
    await this.prisma.$queryRaw`
      SELECT fn_add_product_to_rental(${rentalId}::uuid, ${productId}::uuid, ${quantity}::int, ${cashierId}::uuid)
    `;
    const newItem = await this.prisma.rentalProduct.findFirst({
      where: { rentalId, productId },
      orderBy: { addedAt: 'desc' },
    });
    if (newItem) await this.informixService.mirrorRentalProductRealtime(newItem as any);
    return this.mirrorRental(rentalId);
  }

  // Cierra el alquiler (checkout manual desde caja).
  async checkOut(rentalId: string, cashierId: string) {
    await this.prisma.$queryRaw`
      SELECT fn_check_out(${rentalId}::uuid, ${cashierId}::uuid)
    `;
    return this.mirrorRental(rentalId);
  }

  // Registra el pago del total (puede llamarse más de una vez para pago mixto).
  async registerPayment(rentalId: string, cashierId: string, amount: number, method: string) {
    return this.prisma.payment.create({
      data: {
        rentalId,
        cashierId,
        amount,
        method: method as any,
      },
    });
  }

  getRentalDetail(rentalId: string) {
    return this.prisma.rental.findUnique({
      where: { id: rentalId },
      include: {
        room: true,
        category: true,
        extensions: true,
        products: { include: { product: true } },
        payments: true,
      },
    });
  }

  // Tablero de caja: todas las habitaciones activas/tiempo extra de un hotel.
  listActiveByHotel(hotelId: string) {
    return this.prisma.rental.findMany({
      where: { hotelId, status: { in: ['activa', 'tiempo_extra'] } },
      include: { room: true, category: true },
      orderBy: { checkIn: 'asc' },
    });
  }

  // Pedidos que el huésped hizo desde su cuarto y aún no se han llevado.
  async listPendingDeliveries(hotelId: string) {
    const items = await this.prisma.rentalProduct.findMany({
      where: {
        delivered: false,
        rental: { hotelId, status: { in: ['activa', 'tiempo_extra'] } },
      },
      include: {
        product: true,
        rental: { include: { room: true } },
      },
      orderBy: { addedAt: 'asc' },
    });
    return items.map((i) => ({
      id: i.id,
      roomNumber: i.rental.room.number,
      productName: i.product.name,
      productCode: i.product.internalCode,
      quantity: i.quantity,
      note: i.note,
      addedAt: i.addedAt,
    }));
  }

  markDelivered(itemId: string) {
    return this.prisma.rentalProduct.update({
      where: { id: itemId },
      data: { delivered: true },
    });
  }

  // Habitaciones donde el huésped pidió la cuenta y aún sigue activa (sin cobrar/checkout).
  async listCheckoutRequests(hotelId: string) {
    const rentals = await this.prisma.rental.findMany({
      where: { hotelId, status: { in: ['activa', 'tiempo_extra'] }, checkoutRequested: true },
      include: { room: true },
      orderBy: { checkoutRequestedAt: 'asc' },
    });
    return rentals.map((r) => ({
      rentalId: r.id,
      roomId: r.roomId,
      roomNumber: r.room.number,
      method: r.checkoutRequestedMethod,
      requestedAt: r.checkoutRequestedAt,
    }));
  }

  // Cortesías: producto gratis, monto fijo, o porcentaje (sobre toda la
  // cuenta o solo la habitación). Decisión de los dueños, la aplica el admin.
  async applyCourtesy(
    rentalId: string,
    adminId: string,
    dto: { type: 'product' | 'fixed' | 'percent_total' | 'percent_room'; productId?: string; quantity?: number; amount?: number; percent?: number; note?: string },
  ) {
    const rental = await this.prisma.rental.findUnique({ where: { id: rentalId } });
    if (!rental || !['activa', 'tiempo_extra'].includes(rental.status)) {
      throw new BadRequestException('El alquiler no está activo');
    }

    if (dto.type === 'product') {
      if (!dto.productId) throw new BadRequestException('Falta el producto');
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product || !product.active) throw new BadRequestException('Producto no encontrado');
      const quantity = dto.quantity ?? 1;

      const courtesyItem = await this.prisma.rentalProduct.create({
        data: {
          rentalId,
          productId: dto.productId,
          quantity,
          unitPrice: 0,
          subtotal: 0,
          addedBy: adminId,
          delivered: false,
          note: dto.note?.trim() || 'Cortesía',
        },
      });
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: { decrement: quantity } },
      });
      await this.informixService.mirrorRentalProductRealtime(courtesyItem as any);
      return this.mirrorRental(rentalId);
    }

    // Descuento en dinero: monto fijo o calculado por porcentaje.
    let discount: number;
    let noteDefault: string;

    if (dto.type === 'fixed') {
      discount = dto.amount ?? 0;
      noteDefault = `Cortesía: ${discount.toFixed(2)} de descuento`;
    } else if (dto.type === 'percent_total') {
      const pct = dto.percent ?? 0;
      discount = Math.round(Number(rental.totalAmount) * (pct / 100) * 100) / 100;
      noteDefault = `Cortesía: ${pct}% sobre toda la cuenta`;
    } else if (dto.type === 'percent_room') {
      const pct = dto.percent ?? 0;
      const roomPortion = Number(rental.basePrice) + Number(rental.extraChargesTotal);
      discount = Math.round(roomPortion * (pct / 100) * 100) / 100;
      noteDefault = `Cortesía: ${pct}% sobre la habitación`;
    } else {
      throw new BadRequestException('Tipo de cortesía no válido');
    }

    if (discount <= 0) throw new BadRequestException('El monto de la cortesía debe ser mayor a cero');
    if (discount > Number(rental.totalAmount)) {
      discount = Number(rental.totalAmount); // nunca deja el total en negativo
    }

    const updated = await this.prisma.rental.update({
      where: { id: rentalId },
      data: {
        totalAmount: { decrement: discount },
        courtesyAmount: { increment: discount },
        courtesyNote: dto.note?.trim() || noteDefault,
        courtesyAcknowledged: false,
      },
    });

    return this.mirrorRental(updated.id);
  }

  // Descuentos de cortesía que la cajera aún no ha visto.
  async listCourtesyNotifications(hotelId: string) {
    const rentals = await this.prisma.rental.findMany({
      where: {
        hotelId,
        status: { in: ['activa', 'tiempo_extra'] },
        courtesyAmount: { gt: 0 },
        courtesyAcknowledged: false,
      },
      include: { room: true },
    });
    return rentals.map((r) => ({
      rentalId: r.id,
      roomNumber: r.room.number,
      courtesyAmount: r.courtesyAmount,
      courtesyNote: r.courtesyNote,
    }));
  }

  acknowledgeCourtesy(rentalId: string) {
    return this.prisma.rental.update({
      where: { id: rentalId },
      data: { courtesyAcknowledged: true },
    });
  }
}
