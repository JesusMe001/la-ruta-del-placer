import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // ajustar origenes permitidos en producción

  // Solo activar si de verdad hay un reverse proxy (nginx) delante — de lo
  // contrario, confiar en X-Forwarded-For permitiría falsificar la IP de
  // origen y saltarse el LocalNetworkGuard.
  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
