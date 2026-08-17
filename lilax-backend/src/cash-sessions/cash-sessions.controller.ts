import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashSessionsService } from './cash-sessions.service';
import { IsNumber, Min } from 'class-validator';

class OpenDto {
  @IsNumber() @Min(0) openingAmount: number;
}
class CloseDto {
  @IsNumber() @Min(0) closingAmount: number;
}

@UseGuards(JwtAuthGuard)
@Controller('hotels/:hotelId/cash-sessions')
export class CashSessionsController {
  constructor(private service: CashSessionsService) {}

  @Get('current')
  current(@Req() req: any) {
    return this.service.getCurrent(req.user.userId);
  }

  @Post('open')
  open(@Param('hotelId') hotelId: string, @Body() dto: OpenDto, @Req() req: any) {
    return this.service.open(hotelId, req.user.userId, dto.openingAmount);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseDto) {
    return this.service.close(id, dto.closingAmount);
  }
}
