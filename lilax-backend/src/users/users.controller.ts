import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';
import { IsBoolean, IsIn, IsString, MinLength } from 'class-validator';

class CreateUserDto {
  @IsString() username: string;
  @IsString() @MinLength(4) password: string;
  @IsString() fullName: string;
  @IsIn(['cajera', 'supervisor', 'admin']) role: string;
}

class SetActiveDto {
  @IsBoolean() active: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('hotels/:hotelId/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.usersService.list(hotelId);
  }

  @Post()
  create(@Param('hotelId') hotelId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(hotelId, dto);
  }

  @Patch(':userId/active')
  setActive(@Param('userId') userId: string, @Body() dto: SetActiveDto) {
    return this.usersService.setActive(userId, dto.active);
  }
}
