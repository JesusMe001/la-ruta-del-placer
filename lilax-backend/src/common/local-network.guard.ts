import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Respaldo si el hotel todavía no configuró ninguna red propia desde el admin:
// las 3 redes privadas estándar (RFC1918) + localhost.
const DEFAULT_RANGES = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.1/32',
];

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isValidIPv4(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

function isInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = bitsStr === undefined ? 32 : parseInt(bitsStr, 10);
  if (!isValidIPv4(ip) || !isValidIPv4(range)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

function normalizeIp(rawIp: string): string {
  let ip = rawIp || '';
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

// Detrás de Cloudflare Tunnel todas las conexiones llegan desde cloudflared
// (127.0.0.1); la IP real del cliente viene en CF-Connecting-IP. Solo se
// confía en ese header con TRUST_PROXY=true, porque de lo contrario cualquiera
// podría enviarlo para falsificar su IP.
function getClientIp(request: any): string {
  if (process.env.TRUST_PROXY === 'true') {
    const cfIp = request.headers?.['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) return normalizeIp(cfIp.trim());
  }
  return normalizeIp(request.ip);
}

@Injectable()
export class LocalNetworkGuard implements CanActivate {
  private readonly logger = new Logger(LocalNetworkGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = getClientIp(request);
    const code: string | undefined = request.params?.code;
    const hotelSlug: string | undefined = request.params?.hotelSlug;

    let ranges: string[] = [];
    let hotelId: string | undefined;

    if (code) {
      const room = await this.prisma.room.findUnique({
        where: { qrCode: code },
        select: { hotelId: true },
      });
      hotelId = room?.hotelId;
    } else if (hotelSlug) {
      const hotel = await this.prisma.hotel.findUnique({
        where: { slug: hotelSlug },
        select: { id: true },
      });
      hotelId = hotel?.id;
    }

    if (hotelId) {
      const custom = await this.prisma.allowedNetwork.findMany({
        where: { hotelId },
        select: { cidr: true },
      });
      if (custom.length > 0) {
        ranges = custom.map((c) => c.cidr);
      }
    }

    if (ranges.length === 0) {
      const configured = process.env.ALLOWED_NETWORKS;
      ranges = configured
        ? configured.split(',').map((r) => r.trim()).filter(Boolean)
        : DEFAULT_RANGES;
    }

    const allowed = ranges.some((cidr) => isInCidr(ip, cidr));

    if (!allowed) {
      this.logger.warn(`Acceso bloqueado (fuera de la red del hotel): IP ${ip}`);
      throw new ForbiddenException('Este servicio solo está disponible dentro de la red del hotel.');
    }
    return true;
  }
}
