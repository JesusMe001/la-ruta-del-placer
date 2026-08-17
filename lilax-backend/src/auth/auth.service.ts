import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // Login por hotel: la cajera se identifica con slug del hotel + usuario + password
  async login(hotelSlug: string, username: string, password: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { slug: hotelSlug } });
    if (!hotel || !hotel.active) throw new UnauthorizedException('Hotel no válido');

    const user = await this.prisma.user.findFirst({
      where: { hotelId: hotel.id, username, active: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: user.id,
      hotelId: hotel.id,
      role: user.role,
      username: user.username,
    };

    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
      hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug },
    };
  }
}
