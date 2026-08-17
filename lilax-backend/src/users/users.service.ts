import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(hotelId: string) {
    const users = await this.prisma.user.findMany({
      where: { hotelId },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ passwordHash, ...rest }) => rest);
  }

  async create(hotelId: string, data: { username: string; password: string; fullName: string; role: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { hotelId, username: data.username },
    });
    if (existing) throw new BadRequestException('Ya existe un usuario con ese nombre en este hotel');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        hotelId,
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        role: data.role as any,
      },
    });
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async setActive(userId: string, active: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { active },
    });
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
