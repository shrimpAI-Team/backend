import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface DeviceInfo {
  id: string;
  name: string;
  userAgent?: string;
  ip?: string;
}

export const Device = createParamDecorator((_d, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().device as DeviceInfo;
});
