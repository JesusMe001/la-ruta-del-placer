import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d|[1-2]\d|3[0-2]))?$/;

function isValidCidr(cidr: string): boolean {
  if (!CIDR_REGEX.test(cidr)) return false;
  return cidr
    .split('/')[0]
    .split('.')
    .every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

@Injectable()
export class NetworkService {
  constructor(private prisma: PrismaService) {}

  list(hotelId: string) {
    return this.prisma.allowedNetwork.findMany({
      where: { hotelId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(hotelId: string, cidrInput: string, label?: string) {
    const cidr = cidrInput.trim().includes('/') ? cidrInput.trim() : `${cidrInput.trim()}/32`;
    if (!isValidCidr(cidr)) {
      throw new BadRequestException('Formato inválido. Usa una IP (ej. 192.168.1.50) o un rango CIDR (ej. 192.168.1.0/24).');
    }
    return this.prisma.allowedNetwork.create({
      data: { hotelId, cidr, label: label?.trim() || null },
    });
  }

  async remove(id: string) {
    await this.prisma.allowedNetwork.delete({ where: { id } });
    return { deleted: true };
  }
}
