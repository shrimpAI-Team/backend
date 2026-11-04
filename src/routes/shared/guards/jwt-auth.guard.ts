import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Nếu là public route nhưng client gửi Bearer token, vẫn giải mã để lấy req.user
      const req = context.switchToHttp().getRequest();
      const authHeader = req.headers?.authorization;
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        try {
          await (super.canActivate(context) as Promise<boolean>);
        } catch {
          // Bỏ qua lỗi token trên public route
        }
      }
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
