import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTEMPTS = 8;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  private get endpoint() {
    return process.env.CENTRAL_SYNC_URL; // ej: https://central.larutadelplacer.ec/api/sync
  }
  private get apiKey() {
    return process.env.CENTRAL_SYNC_API_KEY;
  }

  constructor(private prisma: PrismaService) {}

  // Corre cada minuto: toma eventos pendientes del outbox y los empuja
  // al sistema central. Si el endpoint aún no está definido/activo,
  // simplemente no hace nada (los eventos quedan encolados, no se pierden).
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    if (!this.endpoint) return; // aún no configurado por el equipo central

    const pending = await this.prisma.syncOutbox.findMany({
      where: { status: 'pendiente' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const item of pending) {
      try {
        await axios.post(
          this.endpoint,
          {
            hotelId: item.hotelId,
            entityType: item.entityType,
            entityId: item.entityId,
            payload: item.payload,
            occurredAt: item.createdAt,
          },
          {
            headers: { 'x-api-key': this.apiKey ?? '' },
            timeout: 5000,
          },
        );

        await this.prisma.syncOutbox.update({
          where: { id: item.id },
          data: { status: 'enviado', sentAt: new Date() },
        });
      } catch (err: any) {
        const attempts = item.attempts + 1;
        await this.prisma.syncOutbox.update({
          where: { id: item.id },
          data: {
            attempts,
            status: attempts >= MAX_ATTEMPTS ? 'error' : 'pendiente',
            lastError: err?.message ?? 'error desconocido',
          },
        });
        this.logger.warn(`Fallo al sincronizar ${item.entityType}:${item.entityId} (intento ${attempts})`);
      }
    }
  }
}
