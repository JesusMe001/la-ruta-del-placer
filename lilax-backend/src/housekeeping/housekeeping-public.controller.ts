import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { HousekeepingService } from './housekeeping.service';
import { LocalNetworkGuard } from '../common/local-network.guard';

class CodeQueryDto {
  @IsString() code: string;
}

class ClaimDto {
  @IsString() roomId: string;
  @IsString() code: string;
}

// Público (sin login): el personal de limpieza escanea su credencial personal
// (código único) para tomar y liberar habitaciones. Protegido por la misma
// restricción de red del hotel que el menú del huésped.
@UseGuards(LocalNetworkGuard)
@Controller('housekeeping/:hotelSlug')
export class HousekeepingPublicController {
  constructor(private housekeepingService: HousekeepingService) {}

  @Get('whoami')
  whoAmI(@Param('hotelSlug') hotelSlug: string, @Query() query: CodeQueryDto) {
    return this.housekeepingService.whoAmI(hotelSlug, query.code);
  }

  @Get('rooms')
  listRooms(@Param('hotelSlug') hotelSlug: string) {
    return this.housekeepingService.listRooms(hotelSlug);
  }

  @Post('claim')
  claim(@Param('hotelSlug') hotelSlug: string, @Body() dto: ClaimDto) {
    return this.housekeepingService.claim(hotelSlug, dto.roomId, dto.code);
  }

  @Post('finish')
  finish(@Param('hotelSlug') hotelSlug: string, @Body() dto: ClaimDto) {
    return this.housekeepingService.finish(hotelSlug, dto.roomId, dto.code);
  }
}
