import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashSessionsService {
  constructor(private prisma: PrismaService) {}

  getCurrent(cashierId: string) {
    return this.prisma.cashSession.findFirst({
      where: { cashierId, status: 'abierta' },
    });
  }

  async open(hotelId: string, cashierId: string, openingAmount: number) {
    const existing = await this.prisma.cashSession.findFirst({
      where: { cashierId, status: 'abierta' },
    });
    if (existing) throw new BadRequestException('Ya tienes un turno de caja abierto');

    return this.prisma.cashSession.create({
      data: { hotelId, cashierId, openingAmount, status: 'abierta' },
    });
  }

  async close(cashSessionId: string, closingAmount: number) {
    const session = await this.prisma.cashSession.findUnique({ where: { id: cashSessionId } });
    if (!session || session.status !== 'abierta') {
      throw new BadRequestException('Turno de caja no válido o ya cerrado');
    }

    // Total esperado = pagos registrados durante este turno
    const payments = await this.prisma.payment.findMany({
      where: { rental: { cashSessionId } },
    });
    const expected =
      Number(session.openingAmount) + payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return this.prisma.cashSession.update({
      where: { id: cashSessionId },
      data: {
        closingAmount,
        expectedAmount: expected,
        difference: closingAmount - expected,
        closedAt: new Date(),
        status: 'cerrada',
      },
    });
  }
}
