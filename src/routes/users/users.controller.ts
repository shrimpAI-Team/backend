// src/users/users.controller.ts
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { SessionService } from '../auth/session.service';
import { Roles } from '../shared/decorators/roles.decorator';
import {
  type AuthUser,
  CurrentUser,
} from '../shared/decorators/current-user.decorator';
import { Role } from 'src/generated/prisma/enums';

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /** USER + ADMIN đều xem được thông tin của chính mình */
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Roles('ADMIN')
  @Get()
  list(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: q ? { email: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    });
  }

  @Roles('ADMIN')
  @Patch(':id/role')
  async setRole(@Param('id') id: string, @Body('role') role: Role) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    await this.sessions.revokeAll(id, 'ROLE_CHANGED'); // buộc đăng nhập lại
    return user;
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
    if (!isActive) await this.sessions.revokeAll(id, 'ACCOUNT_DISABLED');
    return user;
  }
}
