import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS = {
  programName: 'Extasis Club',
  discountLabel: '10% de descuento en tu próxima estadía',
  highlightProductType: null as string | null,
  backgroundColor: '#170B22',
  active: false,
};

@Injectable()
export class LoyaltyConfigService {
  constructor(private prisma: PrismaService) {}

  async get(hotelId: string) {
    const config = await this.prisma.loyaltyConfig.findUnique({ where: { hotelId } });
    return config ?? { hotelId, ...DEFAULTS };
  }

  async update(
    hotelId: string,
    data: { programName?: string; discountLabel?: string; highlightProductType?: string | null; backgroundColor?: string; active?: boolean },
  ) {
    return this.prisma.loyaltyConfig.upsert({
      where: { hotelId },
      update: data,
      create: { hotelId, ...DEFAULTS, ...data },
    });
  }
}
