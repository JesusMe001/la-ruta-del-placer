import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { NetworkService } from './network.service';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class CreateNetworkDto {
  @IsString() @MaxLength(43) cidr: string;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('hotels/:hotelId/allowed-networks')
export class NetworkController {
  constructor(private networkService: NetworkService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.networkService.list(hotelId);
  }

  @Post()
  create(@Param('hotelId') hotelId: string, @Body() dto: CreateNetworkDto) {
    return this.networkService.create(hotelId, dto.cidr, dto.label);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.networkService.remove(id);
  }
}
