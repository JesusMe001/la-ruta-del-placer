import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RentalsService } from './rentals.service';
import { IsIn, IsInt, IsNumber, IsNumberString, IsOptional, IsString, Min, MaxLength } from 'class-validator';

class CheckInDto {
  @IsString() roomId: string;
  @IsString() cashSessionId: string;
}

class AddProductDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
}

class PaymentDto {
  @IsNumberString() amount: string;
  @IsString() method: string; // efectivo | tarjeta | transferencia | mixto
}

class CourtesyDto {
  @IsIn(['product', 'fixed', 'percent_total', 'percent_room']) type: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsNumber() @Min(0.01) percent?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private rentalsService: RentalsService) {}

  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @Req() req: any) {
    return this.rentalsService.checkIn(dto.roomId, req.user.userId, dto.cashSessionId);
  }

  @Post(':id/products')
  addProduct(@Param('id') id: string, @Body() dto: AddProductDto, @Req() req: any) {
    return this.rentalsService.addProduct(id, dto.productId, dto.quantity, req.user.userId);
  }

  @Post(':id/checkout')
  checkOut(@Param('id') id: string, @Req() req: any) {
    return this.rentalsService.checkOut(id, req.user.userId);
  }

  @Post(':id/payments')
  registerPayment(@Param('id') id: string, @Body() dto: PaymentDto, @Req() req: any) {
    return this.rentalsService.registerPayment(id, req.user.userId, Number(dto.amount), dto.method);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.rentalsService.getRentalDetail(id);
  }

  @Get('active/:hotelId')
  listActive(@Param('hotelId') hotelId: string) {
    return this.rentalsService.listActiveByHotel(hotelId);
  }

  @Get('pending-deliveries/:hotelId')
  pendingDeliveries(@Param('hotelId') hotelId: string) {
    return this.rentalsService.listPendingDeliveries(hotelId);
  }

  @Post('products/:itemId/delivered')
  markDelivered(@Param('itemId') itemId: string) {
    return this.rentalsService.markDelivered(itemId);
  }

  @Get('checkout-requests/:hotelId')
  checkoutRequests(@Param('hotelId') hotelId: string) {
    return this.rentalsService.listCheckoutRequests(hotelId);
  }

  @Post(':id/courtesy')
  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor')
  applyCourtesy(@Param('id') id: string, @Body() dto: CourtesyDto, @Req() req: any) {
    return this.rentalsService.applyCourtesy(id, req.user.userId, dto as any);
  }

  @Get('courtesy-notifications/:hotelId')
  courtesyNotifications(@Param('hotelId') hotelId: string) {
    return this.rentalsService.listCourtesyNotifications(hotelId);
  }

  @Post(':id/acknowledge-courtesy')
  acknowledgeCourtesy(@Param('id') id: string) {
    return this.rentalsService.acknowledgeCourtesy(id);
  }
}
