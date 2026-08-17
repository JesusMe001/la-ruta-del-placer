import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ProductsService } from './products.service';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class CreateProductDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsString() internalCode: string;
  @IsString() name: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsNumber() stock?: number;
}

class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hotels/:hotelId/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.productsService.listByHotel(hotelId);
  }

  @Post()
  @Roles('admin', 'supervisor')
  create(@Param('hotelId') hotelId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(hotelId, dto);
  }

  @Patch(':productId')
  @Roles('admin', 'supervisor')
  update(@Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(productId, dto);
  }
}
