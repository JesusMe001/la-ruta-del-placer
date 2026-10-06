import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InformixService } from '../informix/informix.service';
import { LocalNetworkGuard } from '../common/local-network.guard';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

class GuestOrderDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

class GuestOrderItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

class GuestOrderBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuestOrderItemDto)
  items: GuestOrderItemDto[];
}

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'mixto'];

class RequestCheckoutDto {
  @IsIn(PAYMENT_METHODS) method: string;
}

// Endpoint público (sin auth): el huésped escanea el QR físico de la habitación
// y ve el menú/servicios del hotel, además de su cuenta en tiempo real si la
// habitación tiene un alquiler activo. NO expone nada de caja, ni el id del
// alquiler, ni datos de otros huéspedes — el propio código QR es el único
// "acceso" que se necesita.
//
// Además, solo responde a pedidos que vengan desde dentro de la red del hotel
// (LocalNetworkGuard) — un huésped fuera del wifi del hotel no puede usarlo.
@UseGuards(LocalNetworkGuard)
@Controller('qr')
export class QrController {
  constructor(private prisma: PrismaService, private informixService: InformixService) {}

  private serializeAccount(rental: any) {
    return {
      status: rental.status,
      basePrice: rental.basePrice,
      extraChargesTotal: rental.extraChargesTotal,
      productsTotal: rental.productsTotal,
      totalAmount: rental.totalAmount,
      checkoutRequested: rental.checkoutRequested,
      checkoutRequestedMethod: rental.checkoutRequestedMethod,
      items: rental.products.map((rp: any) => ({
        name: rp.product.name,
        quantity: rp.quantity,
        unitPrice: rp.unitPrice,
        subtotal: rp.subtotal,
        delivered: rp.delivered,
        note: rp.note,
      })),
    };
  }

  private async findActiveRentalByCode(code: string) {
    const room = await this.prisma.room.findUnique({ where: { qrCode: code } });
    if (!room || !room.active) throw new NotFoundException('QR no válido');

    const rental = await this.prisma.rental.findFirst({
      where: { roomId: room.id, status: { in: ['activa', 'tiempo_extra'] } },
      include: { products: { include: { product: true }, orderBy: { addedAt: 'asc' } } },
    });
    return { room, rental };
  }

  @Get(':code')
  async getByQr(@Param('code') code: string) {
    const room = await this.prisma.room.findUnique({
      where: { qrCode: code },
      include: { hotel: true },
    });
    if (!room || !room.active) throw new NotFoundException('QR no válido');

    const products = await this.prisma.product.findMany({
      where: { hotelId: room.hotelId, active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const { rental } = await this.findActiveRentalByCode(code);

    return {
      hotel: { name: room.hotel.name, slug: room.hotel.slug },
      room: { number: room.number },
      menu: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category?.name ?? null,
        imageUrl: p.imageUrl,
      })),
      account: rental ? this.serializeAccount(rental) : null,
    };
  }

  @Post(':code/order')
  async order(@Param('code') code: string, @Body() dto: GuestOrderDto) {
    const { rental: existingRental } = await this.findActiveRentalByCode(code);
    if (existingRental?.checkoutRequested) {
      throw new BadRequestException(
        'Ya pediste la cuenta — no se pueden agregar más productos. Si necesitas algo más, comunícate con recepción.',
      );
    }

    const rows = await this.prisma.$queryRaw<{ fn_guest_add_product: string }[]>`
      SELECT fn_guest_add_product(${code}, ${dto.productId}::uuid, ${dto.quantity}::int, ${dto.note ?? null})
    `;
    const rentalId = rows[0].fn_guest_add_product;
    const rental = await this.prisma.rental.findUnique({
      where: { id: rentalId },
      include: { products: { include: { product: true }, orderBy: { addedAt: 'asc' } } },
    });

    const newItem = await this.prisma.rentalProduct.findFirst({
      where: { rentalId, productId: dto.productId },
      orderBy: { addedAt: 'desc' },
    });
    if (rental) await this.informixService.mirrorRentalRealtime(rental as any);
    if (newItem) await this.informixService.mirrorRentalProductRealtime(newItem as any);

    return { account: this.serializeAccount(rental) };
  }

  // El carrito completo del huésped se envía de una sola vez: cada producto
  // se agrega dentro de la misma transacción, para que quede todo o nada.
  @Post(':code/order-batch')
  async orderBatch(@Param('code') code: string, @Body() dto: GuestOrderBatchDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito está vacío');
    }

    const { rental: existingRental } = await this.findActiveRentalByCode(code);
    if (existingRental?.checkoutRequested) {
      throw new BadRequestException(
        'Ya pediste la cuenta — no se pueden agregar más productos. Si necesitas algo más, comunícate con recepción.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.$queryRaw`
          SELECT fn_guest_add_product(${code}, ${item.productId}::uuid, ${item.quantity}::int, ${item.note ?? null})
        `;
      }
    });

    const { rental } = await this.findActiveRentalByCode(code);

    // Refleja en Informix el alquiler completo y cada línea del carrito que
    // se acaba de agregar — esto es lo que dispara su alerta de "llevar
    // producto a la habitación" del lado de ellos.
    if (rental) {
      await this.informixService.mirrorRentalRealtime(rental as any);
      for (const item of dto.items) {
        const newItem = await this.prisma.rentalProduct.findFirst({
          where: { rentalId: rental.id, productId: item.productId },
          orderBy: { addedAt: 'desc' },
        });
        if (newItem) await this.informixService.mirrorRentalProductRealtime(newItem as any);
      }
    }

    return { account: this.serializeAccount(rental) };
  }

  @Post(':code/request-checkout')
  async requestCheckout(@Param('code') code: string, @Body() dto: RequestCheckoutDto) {
    const { rental } = await this.findActiveRentalByCode(code);
    if (!rental) throw new NotFoundException('Esta habitación no tiene un alquiler activo en este momento');

    const updated = await this.prisma.rental.update({
      where: { id: rental.id },
      data: {
        checkoutRequested: true,
        checkoutRequestedMethod: dto.method,
        checkoutRequestedAt: new Date(),
      },
      include: { products: { include: { product: true }, orderBy: { addedAt: 'asc' } } },
    });

    return { account: this.serializeAccount(updated) };
  }
}
