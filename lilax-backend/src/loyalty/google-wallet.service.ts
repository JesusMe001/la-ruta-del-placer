import { Injectable, Logger } from '@nestjs/common';
import { webcrypto, randomBytes } from 'crypto';

const crypto = webcrypto as unknown as Crypto;
const encoder = new TextEncoder();

interface GoogleWalletEnv {
  enabled: boolean;
  issuerId: string;
  classSuffix: string;
  serviceAccountEmail: string;
  privateKey: string;
  publicAssetsBaseUrl: string;
}

function readEnv(): GoogleWalletEnv {
  return {
    enabled: (process.env.GOOGLE_WALLET_ENABLED ?? 'false').toLowerCase() === 'true',
    issuerId: (process.env.GOOGLE_WALLET_ISSUER_ID ?? '').trim(),
    classSuffix: (process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? 'lilax_v1').trim(),
    serviceAccountEmail: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '').trim(),
    privateKey: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim(),
    publicAssetsBaseUrl: (process.env.PUBLIC_ASSETS_BASE_URL ?? '').replace(/\/+$/, ''),
  };
}

function isConfigured(env: GoogleWalletEnv): boolean {
  return !!(
    env.enabled &&
    env.issuerId &&
    env.serviceAccountEmail &&
    env.privateKey &&
    env.publicAssetsBaseUrl.startsWith('https://')
  );
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return Buffer.from(binary, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const buffer = Buffer.from(normalized, 'base64');
  // Copia limpia: el buffer de Buffer.from puede compartir un ArrayBuffer más
  // grande (pooling de Node), lo que rompe la validación de tipos de crypto.subtle.
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function importPrivateKey(pem: string) {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signRs256(header: Record<string, unknown>, payload: Record<string, unknown>, privateKeyPem: string) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

@Injectable()
export class GoogleWalletService {
  private readonly logger = new Logger(GoogleWalletService.name);
  private cachedToken: { token: string; expiresAt: number } | null = null;

  status() {
    const env = readEnv();
    return {
      configured: isConfigured(env),
      enabled: env.enabled,
      missing: [
        !env.issuerId && 'GOOGLE_WALLET_ISSUER_ID',
        !env.serviceAccountEmail && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        !env.privateKey && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        !env.publicAssetsBaseUrl.startsWith('https://') && 'PUBLIC_ASSETS_BASE_URL (debe ser https://)',
      ].filter(Boolean),
    };
  }

  private classId(env: GoogleWalletEnv) {
    return `${env.issuerId}.${env.classSuffix}`;
  }

  private image(env: GoogleWalletEnv, path: string, description: string) {
    return {
      sourceUri: { uri: `${env.publicAssetsBaseUrl}${path}` },
      contentDescription: { defaultValue: { language: 'es', value: description } },
    };
  }

  private async getAccessToken(env: GoogleWalletEnv) {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }
    const now = Math.floor(Date.now() / 1000);
    const assertion = await signRs256(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: env.serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      env.privateKey,
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const payload: any = await res.json();
    if (!res.ok || !payload.access_token) {
      throw new Error(payload.error_description ?? payload.error ?? 'Google rechazó la autenticación.');
    }
    this.cachedToken = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
    return this.cachedToken.token;
  }

  private async walletRequest(env: GoogleWalletEnv, path: string, init: RequestInit = {}) {
    const token = await this.getAccessToken(env);
    return fetch(`https://walletobjects.googleapis.com/walletobjects/v1/${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  }

  // Crea o actualiza la clase de la tarjeta con el contenido que el admin
  // parametrizó (nombre del programa, color, beneficio destacado).
  async syncLoyaltyClass(config: {
    programName: string;
    discountLabel: string;
    highlightProductType?: string | null;
    backgroundColor: string;
  }) {
    const env = readEnv();
    if (!isConfigured(env)) {
      return { synced: false, reason: 'not_configured' as const };
    }

    const id = this.classId(env);
    const classBody = {
      id,
      issuerName: 'La Ruta del Placer',
      programName: config.programName,
      reviewStatus: 'UNDER_REVIEW',
      programLogo: this.image(env, '/brand/program-logo.png', 'Logo del programa'),
      wideProgramLogo: this.image(env, '/brand/wide-program-logo.png', config.programName),
      heroImage: this.image(env, '/brand/hero-half-apple.png', 'Imagen destacada'),
      hexBackgroundColor: config.backgroundColor,
      accountNameLabel: 'Miembro',
      accountIdLabel: 'Código',
      multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    };

    const existing = await this.walletRequest(env, `loyaltyClass/${encodeURIComponent(id)}`);
    if (existing.ok) {
      const patch = await this.walletRequest(env, `loyaltyClass/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(classBody),
      });
      if (!patch.ok) {
        this.logger.warn(`No se pudo actualizar la clase de Wallet: ${await patch.text()}`);
        return { synced: false, reason: 'update_failed' as const };
      }
      return { synced: true, classId: id };
    }

    if (existing.status !== 404) {
      return { synced: false, reason: 'lookup_failed' as const };
    }

    const created = await this.walletRequest(env, 'loyaltyClass', {
      method: 'POST',
      body: JSON.stringify(classBody),
    });
    if (!created.ok && created.status !== 409) {
      this.logger.warn(`No se pudo crear la clase de Wallet: ${await created.text()}`);
      return { synced: false, reason: 'create_failed' as const };
    }
    return { synced: true, classId: id };
  }

  // Genera un enlace "Agregar a Google Wallet" de vista previa, para que el
  // admin pueda probar cómo se ve la tarjeta con la configuración actual.
  async generatePreviewSaveUrl(config: {
    programName: string;
    discountLabel: string;
    highlightProductType?: string | null;
    backgroundColor: string;
  }) {
    const env = readEnv();
    if (!isConfigured(env)) {
      return { configured: false, missing: this.status().missing };
    }

    await this.syncLoyaltyClass(config);

    const previewCode = randomBytes(4).toString('hex').toUpperCase();
    const objectId = `${env.issuerId}.preview_${previewCode.toLowerCase()}`;
    const object: Record<string, unknown> = {
      id: objectId,
      classId: this.classId(env),
      state: 'ACTIVE',
      accountName: 'Vista previa',
      accountId: previewCode,
      textModulesData: [
        { id: 'beneficio', header: 'Tu beneficio', body: config.discountLabel },
        ...(config.highlightProductType
          ? [{ id: 'aplica_en', header: 'Aplica en', body: config.highlightProductType }]
          : []),
      ],
      barcode: { type: 'QR_CODE', value: `preview:${previewCode}`, alternateText: previewCode },
    };

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signRs256(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: env.serviceAccountEmail,
        aud: 'google',
        typ: 'savetowallet',
        iat: now,
        origins: [env.publicAssetsBaseUrl],
        payload: { loyaltyObjects: [object] },
      },
      env.privateKey,
    );

    return { configured: true, saveUrl: `https://pay.google.com/gp/v/save/${jwt}` };
  }
}
