import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  listByHotel(hotelId: string) {
    return this.prisma.product.findMany({
      where: { hotelId, active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  create(hotelId: string, data: { categoryId?: string; internalCode: string; name: string; price: number; cost?: number; stock?: number }) {
    return this.prisma.product.create({
      data: {
        hotelId,
        categoryId: data.categoryId,
        internalCode: data.internalCode,
        name: data.name,
        price: data.price,
        cost: data.cost ?? 0,
        stock: data.stock ?? 0,
      },
    });
  }

  adjustStock(productId: string, delta: number) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    });
  }

  update(productId: string, data: { name?: string; price?: number; imageUrl?: string; active?: boolean }) {
    return this.prisma.product.update({
      where: { id: productId },
      data,
    });
  }
}
