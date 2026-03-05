import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHello(): Promise<{  payload: string }> {
    const payload = await this.appService.getHello();
    return { payload };
  }
}
