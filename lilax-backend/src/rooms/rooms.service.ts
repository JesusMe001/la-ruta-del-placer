import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  listByHotel(hotelId: string) {
    return this.prisma.room.findMany({
      where: { hotelId },
      include: { category: true },
      orderBy: { number: 'asc' },
    });
  }

  create(hotelId: string, categoryId: string, number: string, floor?: string) {
    return this.prisma.room.create({
      data: {
        hotelId,
        categoryId,
        number,
        floor,
        qrCode: randomBytes(12).toString('hex'), // token opaco para el QR físico
      },
    });
  }

  setStatus(roomId: string, status: string) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { status: status as any },
    });
  }
}
