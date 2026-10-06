import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { NetworkModule } from '../network/network.module';
import { InformixModule } from '../informix/informix.module';

@Module({
  imports: [NetworkModule, InformixModule],
  controllers: [QrController],
})
export class QrModule {}
