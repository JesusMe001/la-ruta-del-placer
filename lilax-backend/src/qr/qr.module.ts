import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { NetworkModule } from '../network/network.module';

@Module({
  imports: [NetworkModule],
  controllers: [QrController],
})
export class QrModule {}
