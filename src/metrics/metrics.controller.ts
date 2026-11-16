import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { register, collectDefaultMetrics } from 'prom-client';

collectDefaultMetrics();

@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  @Get()
  @Header('content-type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
