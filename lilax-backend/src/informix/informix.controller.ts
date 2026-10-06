import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { InformixService } from './informix.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('hotels/:hotelId/informix')
export class InformixController {
  constructor(private informixService: InformixService) {}

  @Get('status')
  status() {
    return this.informixService.status();
  }

  @Get('test')
  test() {
    return this.informixService.testConnection();
  }

  @Get('rooms')
  rooms(@Query('sucursal') sucursal?: string) {
    return this.informixService.listRoomsRaw(sucursal ? Number(sucursal) : undefined);
  }

  @Get('menu')
  menu(@Query('bodega') bodega: string, @Query('sucursal') sucursal?: string) {
    return this.informixService.listMenuRaw(Number(bodega), sucursal ? Number(sucursal) : undefined);
  }

  @Get('guest')
  guest(@Query('habitacion') habitacion: string, @Query('sucursal') sucursal?: string) {
    return this.informixService.lastGuestForRoom(habitacion, sucursal ? Number(sucursal) : undefined);
  }

  @Post('import-rooms')
  importRooms(@Param('hotelId') hotelId: string, @Query('sucursal') sucursal?: string) {
    return this.informixService.importRealRooms(hotelId, sucursal ? Number(sucursal) : undefined);
  }

  @Post('import-products')
  importProducts(
    @Param('hotelId') hotelId: string,
    @Query('bodega') bodega?: string,
    @Query('sucursal') sucursal?: string,
  ) {
    return this.informixService.importRealProducts(
      hotelId,
      bodega ? Number(bodega) : undefined,
      sucursal ? Number(sucursal) : undefined,
    );
  }

  @Post('push-rooms')
  pushRooms(@Param('hotelId') hotelId: string) {
    return this.informixService.pushRoomsToInformix(hotelId);
  }

  @Post('push-products')
  pushProducts(@Param('hotelId') hotelId: string) {
    return this.informixService.pushProductsToInformix(hotelId);
  }
}
