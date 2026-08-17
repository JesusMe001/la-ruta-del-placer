import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyConfigService } from './loyalty-config.service';
import { GoogleWalletService } from './google-wallet.service';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyConfigService, GoogleWalletService],
})
export class LoyaltyModule {}
