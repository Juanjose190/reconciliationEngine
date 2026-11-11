import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../common/role.enum';
import { CreateScenarioDto } from './blockchain-sim.dto';
import { BlockchainSimService } from './blockchain-sim.service';

@Controller('simulator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainSimController {
  constructor(private readonly sim: BlockchainSimService) {}

  @Post('scenarios')
  @Roles(Role.ADMIN, Role.OPERATOR)
  createScenario(@CurrentUser() me: JwtPayload, @Body() dto: CreateScenarioDto) {
    return this.sim.runScenario(me.tenantId, me.tenantSlug, me.sub, dto);
  }
}
