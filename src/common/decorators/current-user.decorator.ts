import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from 'src/generated/prisma/enums';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    return field ? user?.[field] : user;
  },
);
