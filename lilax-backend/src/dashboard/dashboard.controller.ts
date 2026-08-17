import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('hotels/:hotelId/dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('realtime')
  realtime(@Param('hotelId') hotelId: string) {
    return this.dashboardService.realtime(hotelId);
  }

  @Get('historic')
  historic(@Param('hotelId') hotelId: string, @Query('days') days?: string) {
    return this.dashboardService.historic(hotelId, days ? Number(days) : 30);
  }

  @Get('top-products')
  topProducts(@Param('hotelId') hotelId: string, @Query('days') days?: string) {
    return this.dashboardService.topProducts(hotelId, days ? Number(days) : 30);
  }

  @Get('cash-sessions')
  cashSessions(@Param('hotelId') hotelId: string) {
    return this.dashboardService.cashSessionsHistory(hotelId);
  }
}
