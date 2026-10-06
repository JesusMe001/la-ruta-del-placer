import { Module } from '@nestjs/common';
import { InformixController } from './informix.controller';
import { InformixService } from './informix.service';

@Module({
  controllers: [InformixController],
  providers: [InformixService],
  exports: [InformixService],
})
export class InformixModule {}
