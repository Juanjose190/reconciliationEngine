import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../common/role.enum';
import { ChangeRoleDto, CreateUserDto, SetActiveDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  async create(@CurrentUser() me: JwtPayload, @Body() dto: CreateUserDto) {
    return UsersService.toPublic(await this.users.create(me.tenantId, dto));
  }

  @Get()
  async list(@CurrentUser() me: JwtPayload) {
    return (await this.users.list(me.tenantId)).map(UsersService.toPublic);
  }

  @Patch(':id/role')
  async changeRole(@CurrentUser() me: JwtPayload, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    if (id === me.sub) throw new BadRequestException('No puedes cambiar tu propio rol');
    return UsersService.toPublic(await this.users.changeRole(me.tenantId, id, dto.role));
  }

  @Patch(':id/active')
  async setActive(@CurrentUser() me: JwtPayload, @Param('id') id: string, @Body() dto: SetActiveDto) {
    if (id === me.sub) throw new BadRequestException('No puedes desactivarte a ti mismo');
    return UsersService.toPublic(await this.users.setActive(me.tenantId, id, dto.active));
  }
}
