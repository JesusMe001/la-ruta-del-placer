import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { HousekeepingService } from './housekeeping.service';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

class CreateStaffDto {
  @IsString() @MaxLength(120) name: string;
}
class SetActiveDto {
  @IsBoolean() active: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('hotels/:hotelId/housekeeping-staff')
export class HousekeepingAdminController {
  constructor(private housekeepingService: HousekeepingService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.housekeepingService.list(hotelId);
  }

  @Post()
  create(@Param('hotelId') hotelId: string, @Body() dto: CreateStaffDto) {
    return this.housekeepingService.create(hotelId, dto.name);
  }

  @Patch(':staffId/active')
  setActive(@Param('staffId') staffId: string, @Body() dto: SetActiveDto) {
    return this.housekeepingService.setActive(staffId, dto.active);
  }
}
