import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // ---------- TIEMPO REAL ----------
  async realtime(hotelId: string) {
    const rooms = await this.prisma.room.findMany({ where: { hotelId }, select: { status: true } });
    const roomsByStatus: Record<string, number> = {};
    for (const r of rooms) roomsByStatus[r.status] = (roomsByStatus[r.status] || 0) + 1;

    const activeRentals = await this.prisma.rental.findMany({
      where: { hotelId, status: { in: ['activa', 'tiempo_extra'] } },
      select: { totalAmount: true },
    });
    const activeValue = activeRentals.reduce((sum, r) => sum + Number(r.totalAmount), 0);

    const openSessions = await this.prisma.cashSession.findMany({
      where: { hotelId, status: 'abierta' },
      include: { cashier: { select: { fullName: true } } },
    });
    const openSessionsDetail = await Promise.all(
      openSessions.map(async (s) => {
        const payments = await this.prisma.payment.findMany({ where: { rental: { cashSessionId: s.id } } });
        const collected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          cashierName: s.cashier.fullName,
          openingAmount: s.openingAmount,
          collected,
          expected: Number(s.openingAmount) + collected,
          openedAt: s.openedAt,
        };
      }),
    );

    const pendingDeliveries = await this.prisma.rentalProduct.count({
      where: { delivered: false, rental: { hotelId, status: { in: ['activa', 'tiempo_extra'] } } },
    });
    const checkoutRequests = await this.prisma.rental.count({
      where: { hotelId, status: { in: ['activa', 'tiempo_extra'] }, checkoutRequested: true },
    });

    return {
      roomsByStatus,
      activeRentalsCount: activeRentals.length,
      activeValue,
      openSessions: openSessionsDetail,
      pendingDeliveries,
      checkoutRequests,
    };
  }

  // ---------- HISTÓRICO ----------
  async historic(hotelId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const finished = await this.prisma.rental.findMany({
      where: { hotelId, status: 'finalizada', checkOut: { gte: since } },
      select: { basePrice: true, extraChargesTotal: true, productsTotal: true, totalAmount: true, checkOut: true },
    });

    const totalRevenue = finished.reduce((sum, r) => sum + Number(r.totalAmount), 0);
    const roomRevenue = finished.reduce((sum, r) => sum + Number(r.basePrice) + Number(r.extraChargesTotal), 0);
    const productRevenue = finished.reduce((sum, r) => sum + Number(r.productsTotal), 0);
    const rentalsCount = finished.length;
    const averageTicket = rentalsCount > 0 ? totalRevenue / rentalsCount : 0;

    // Ingresos agrupados por día
    const byDayMap: Record<string, number> = {};
    for (const r of finished) {
      const day = r.checkOut.toISOString().slice(0, 10);
      byDayMap[day] = (byDayMap[day] || 0) + Number(r.totalAmount);
    }
    const revenueByDay = Object.entries(byDayMap)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      days,
      totalRevenue,
      roomRevenue,
      productRevenue,
      rentalsCount,
      averageTicket,
      revenueByDay,
    };
  }

  async topProducts(hotelId: string, days: number, limit = 10) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const items = await this.prisma.rentalProduct.findMany({
      where: { rental: { hotelId }, addedAt: { gte: since } },
      include: { product: true },
    });

    const map: Record<string, { name: string; code: string; quantity: number; revenue: number }> = {};
    for (const i of items) {
      const key = i.productId;
      if (!map[key]) {
        map[key] = { name: i.product.name, code: i.product.internalCode, quantity: 0, revenue: 0 };
      }
      map[key].quantity += i.quantity;
      map[key].revenue += Number(i.subtotal);
    }

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async cashSessionsHistory(hotelId: string, limit = 20) {
    const sessions = await this.prisma.cashSession.findMany({
      where: { hotelId, status: 'cerrada' },
      include: { cashier: { select: { fullName: true } } },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });
    return sessions.map((s) => ({
      cashierName: s.cashier.fullName,
      openingAmount: s.openingAmount,
      closingAmount: s.closingAmount,
      expectedAmount: s.expectedAmount,
      difference: s.difference,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
    }));
  }
}
