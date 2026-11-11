import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Role } from '../common/role.enum';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 10;

/**
 * Aislamiento por columna discriminadora: TODOS los métodos reciben tenantId y
 * lo incluyen en el WHERE. No existe ningún método que consulte usuarios sin tenant.
 */
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async create(tenantId: string, input: { email: string; password: string; role: Role }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { tenantId, email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo en este tenant');

    const user = this.users.create({
      tenantId,
      email,
      passwordHash: await UsersService.hashPassword(input.password),
      role: input.role,
    });
    return this.users.save(user);
  }

  findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.users.findOne({ where: { tenantId, email: email.trim().toLowerCase() } });
  }

  list(tenantId: string): Promise<User[]> {
    return this.users.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<User> {
    const user = await this.users.findOne({ where: { tenantId, id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async changeRole(tenantId: string, id: string, role: Role): Promise<User> {
    const user = await this.findOne(tenantId, id);
    user.role = role;
    return this.users.save(user);
  }

  async setActive(tenantId: string, id: string, active: boolean): Promise<User> {
    const user = await this.findOne(tenantId, id);
    user.active = active;
    return this.users.save(user);
  }

  /** Nunca exponer el hash. */
  static toPublic(user: User) {
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }
}
