import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger, shouldServeSwagger } from './swagger.setup';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return 'pong';
  }
}

@Module({ controllers: [PingController] })
class TinyModule {}

describe('setupSwagger', () => {
  let app: INestApplication;

  const bootWith = async (nodeEnv: string | undefined) => {
    app = await NestFactory.create(TinyModule, { logger: false });
    const mounted = setupSwagger(app, nodeEnv);
    await app.listen(0);
    const url = await app.getUrl();
    return { mounted, url: url.replace('[::1]', 'localhost') };
  };

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('is off only in production', () => {
    expect(shouldServeSwagger('production')).toBe(false);
    expect(shouldServeSwagger('development')).toBe(true);
    expect(shouldServeSwagger('test')).toBe(true);
    expect(shouldServeSwagger(undefined)).toBe(true);
  });

  it('does not mount /apidoc in production (404)', async () => {
    const setupSpy = jest.spyOn(SwaggerModule, 'setup');
    const { mounted, url } = await bootWith('production');
    expect(mounted).toBe(false);
    expect(setupSpy).not.toHaveBeenCalled();
    expect((await fetch(`${url}/apidoc`)).status).toBe(404);
    expect((await fetch(`${url}/apidoc-json`)).status).toBe(404);
    expect((await fetch(`${url}/ping`)).status).toBe(200);
  });

  it('mounts /apidoc outside production', async () => {
    const { mounted, url } = await bootWith('development');
    expect(mounted).toBe(true);
    expect((await fetch(`${url}/apidoc`)).status).toBe(200);
  });
});
