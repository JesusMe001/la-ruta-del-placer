import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class HousekeepingService {
  constructor(private prisma: PrismaService) {}

  // ---------- Gestión (admin) ----------
  list(hotelId: string) {
    return this.prisma.housekeepingStaff.findMany({
      where: { hotelId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(hotelId: string, name: string) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    return this.prisma.housekeepingStaff.create({
      data: { hotelId, name: name.trim(), code },
    });
  }

  setActive(staffId: string, active: boolean) {
    return this.prisma.housekeepingStaff.update({
      where: { id: staffId },
      data: { active },
    });
  }

  // ---------- Flujo público (sin login) ----------
  private async getHotelBySlug(hotelSlug: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { slug: hotelSlug } });
    if (!hotel || !hotel.active) throw new NotFoundException('Hotel no válido');
    return hotel;
  }

  private async getStaffByCode(hotelId: string, code: string) {
    const staff = await this.prisma.housekeepingStaff.findFirst({
      where: { hotelId, code: code.trim().toUpperCase(), active: true },
    });
    if (!staff) throw new ForbiddenException('Credencial no válida');
    return staff;
  }

  async whoAmI(hotelSlug: string, code: string) {
    const hotel = await this.getHotelBySlug(hotelSlug);
    const staff = await this.getStaffByCode(hotel.id, code);
    return { id: staff.id, name: staff.name };
  }

  async listRooms(hotelSlug: string) {
    const hotel = await this.getHotelBySlug(hotelSlug);
    const rooms = await this.prisma.room.findMany({
      where: { hotelId: hotel.id, status: { in: ['pendiente_limpieza', 'limpieza'] } },
      include: { category: true, cleaningStaff: true },
      orderBy: { number: 'asc' },
    });
    return rooms.map((r) => ({
      id: r.id,
      number: r.number,
      category: r.category?.name ?? null,
      status: r.status,
      cleaningStaffName: r.cleaningStaff?.name ?? null,
      cleaningClaimedAt: r.cleaningClaimedAt,
    }));
  }

  async claim(hotelSlug: string, roomId: string, code: string) {
    const hotel = await this.getHotelBySlug(hotelSlug);
    const staff = await this.getStaffByCode(hotel.id, code);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId: hotel.id, status: 'pendiente_limpieza' },
    });
    if (!room) throw new BadRequestException('Esta habitación ya no está disponible para tomar.');

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'limpieza', cleaningStaffId: staff.id, cleaningClaimedAt: new Date() },
    });

    return this.listRooms(hotelSlug);
  }

  async finish(hotelSlug: string, roomId: string, code: string) {
    const hotel = await this.getHotelBySlug(hotelSlug);
    const staff = await this.getStaffByCode(hotel.id, code);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId: hotel.id, status: 'limpieza' },
    });
    if (!room) throw new BadRequestException('Esta habitación no está en limpieza.');
    if (room.cleaningStaffId !== staff.id) {
      throw new ForbiddenException('Esta habitación la tomó otro compañero.');
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'libre', cleaningStaffId: null, cleaningClaimedAt: null },
    });

    return this.listRooms(hotelSlug);
  }
}
