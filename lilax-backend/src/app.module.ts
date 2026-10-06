import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { ProductsModule } from './products/products.module';
import { RentalsModule } from './rentals/rentals.module';
import { CashSessionsModule } from './cash-sessions/cash-sessions.module';
import { QrModule } from './qr/qr.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NetworkModule } from './network/network.module';
import { HousekeepingModule } from './housekeeping/housekeeping.module';
import { InformixModule } from './informix/informix.module';
import { AutoExtensionScheduler } from './scheduler/auto-extension.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    RoomsModule,
    ProductsModule,
    RentalsModule,
    CashSessionsModule,
    QrModule,
    SyncModule,
    UsersModule,
    DashboardModule,
    LoyaltyModule,
    NetworkModule,
    HousekeepingModule,
    InformixModule,
  ],
  providers: [AutoExtensionScheduler],
})
export class AppModule {}
