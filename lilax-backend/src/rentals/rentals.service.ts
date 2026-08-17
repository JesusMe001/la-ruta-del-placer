import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  // Abre un alquiler: cobra el precio base de 4h y ocupa la habitación.
  async checkIn(roomId: string, cashierId: string, cashSessionId: string) {
    const rows = await this.prisma.$queryRaw<{ fn_check_in: string }[]>`
      SELECT fn_check_in(${roomId}::uuid, ${cashierId}::uuid, ${cashSessionId}::uuid)
    `;
    const rentalId = rows[0].fn_check_in;
    return this.getRentalDetail(rentalId);
  }

  // Agrega un producto (minibar/consumo) al alquiler activo.
  async addProduct(rentalId: string, productId: string, quantity: number, cashierId: string) {
    await this.prisma.$queryRaw`
      SELECT fn_add_product_to_rental(${rentalId}::uuid, ${productId}::uuid, ${quantity}::int, ${cashierId}::uuid)
    `;
    return this.getRentalDetail(rentalId);
  }

  // Cierra el alquiler (checkout manual desde caja).
  async checkOut(rentalId: string, cashierId: string) {
    await this.prisma.$queryRaw`
      SELECT fn_check_out(${rentalId}::uuid, ${cashierId}::uuid)
    `;
    return this.getRentalDetail(rentalId);
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
}
