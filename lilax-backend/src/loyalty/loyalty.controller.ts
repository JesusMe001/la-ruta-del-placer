import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { LoyaltyConfigService } from './loyalty-config.service';
import { GoogleWalletService } from './google-wallet.service';
import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

class UpdateLoyaltyConfigDto {
  @IsOptional() @IsString() @MaxLength(80) programName?: string;
  @IsOptional() @IsString() @MaxLength(120) discountLabel?: string;
  @IsOptional() @IsString() @MaxLength(80) highlightProductType?: string | null;
  @IsOptional() @IsHexColor() backgroundColor?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('hotels/:hotelId/loyalty')
export class LoyaltyController {
  constructor(
    private configService: LoyaltyConfigService,
    private googleWallet: GoogleWalletService,
  ) {}

  @Get('config')
  getConfig(@Param('hotelId') hotelId: string) {
    return this.configService.get(hotelId);
  }

  @Put('config')
  async updateConfig(@Param('hotelId') hotelId: string, @Body() dto: UpdateLoyaltyConfigDto) {
    const updated = await this.configService.update(hotelId, dto);
    // Si Google Wallet ya está configurado, refleja el cambio en la clase real.
    await this.googleWallet.syncLoyaltyClass(updated);
    return updated;
  }

  @Get('google-wallet-status')
  googleWalletStatus() {
    return this.googleWallet.status();
  }

  @Post('preview')
  async preview(@Param('hotelId') hotelId: string) {
    const config = await this.configService.get(hotelId);
    return this.googleWallet.generatePreviewSaveUrl(config);
  }
}
