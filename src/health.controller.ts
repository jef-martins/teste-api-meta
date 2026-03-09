import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'online', mensagem: 'Telebots NestJS API rodando!' };
  }
}
