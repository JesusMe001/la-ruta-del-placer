import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutoExtensionScheduler {
  private readonly logger = new Logger(AutoExtensionScheduler.name);

  constructor(private prisma: PrismaService) {}

  // Corre cada 5 minutos: revisa alquileres vencidos y cobra
  // automáticamente el siguiente bloque de 4h (fn_apply_auto_extensions).
  // Ajustable según qué tan "en tiempo real" necesiten ver el cambio en caja.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    const rows = await this.prisma.$queryRaw<{ fn_apply_auto_extensions: number }[]>`
      SELECT fn_apply_auto_extensions()
    `;
    const count = rows[0]?.fn_apply_auto_extensions ?? 0;
    if (count > 0) {
      this.logger.log(`Se aplicaron ${count} extensión(es) automática(s) de tiempo`);
    }
  }
}
