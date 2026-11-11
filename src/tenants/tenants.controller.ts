import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PlatformKeyGuard } from '../auth/platform-key.guard';
import { CreateTenantDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(PlatformKeyGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }
}
