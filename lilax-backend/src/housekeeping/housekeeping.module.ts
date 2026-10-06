import { Module } from '@nestjs/common';
import { HousekeepingPublicController } from './housekeeping-public.controller';
import { HousekeepingAdminController } from './housekeeping-admin.controller';
import { HousekeepingService } from './housekeeping.service';
import { NetworkModule } from '../network/network.module';

@Module({
  imports: [NetworkModule],
  controllers: [HousekeepingPublicController, HousekeepingAdminController],
  providers: [HousekeepingService],
})
export class HousekeepingModule {}
