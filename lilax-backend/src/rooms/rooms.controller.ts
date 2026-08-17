import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RoomsService } from './rooms.service';
import { IsOptional, IsString } from 'class-validator';

class CreateRoomDto {
  @IsString() categoryId: string;
  @IsString() number: string;
  @IsOptional() @IsString() floor?: string;
}

class SetStatusDto {
  @IsString() status: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hotels/:hotelId/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.roomsService.listByHotel(hotelId);
  }

  @Post()
  @Roles('admin', 'supervisor')
  create(@Param('hotelId') hotelId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(hotelId, dto.categoryId, dto.number, dto.floor);
  }

  @Patch(':roomId/status')
  @Roles('admin', 'supervisor', 'cajera')
  setStatus(@Param('roomId') roomId: string, @Body() dto: SetStatusDto) {
    return this.roomsService.setStatus(roomId, dto.status);
  }
}
