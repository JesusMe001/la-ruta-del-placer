import { Module } from '@nestjs/common';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';
import { LocalNetworkGuard } from '../common/local-network.guard';

@Module({
  controllers: [NetworkController],
  providers: [NetworkService, LocalNetworkGuard],
  exports: [LocalNetworkGuard],
})
export class NetworkModule {}
