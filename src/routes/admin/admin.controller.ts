import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import {
  CreateUserDto,
  ResetPasswordDto,
  SetRoleDto,
  SetStatusDto,
  UserQueryDto,
} from './dto/admin.dto';

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  getUsers(@Query() query: UserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id/role')
  setUserRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.setUserRole(id, dto.role, adminId);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.setUserStatus(id, dto.isActive, adminId);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.adminService.resetUserPassword(id, dto.newPassword);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.deleteUser(id, adminId);
  }

  @Post('users/:id/revoke-sessions')
  revokeAllUserSessions(@Param('id') id: string) {
    return this.adminService.revokeAllUserSessions(id);
  }

  @Get('sessions')
  getAllSessions() {
    return this.adminService.getAllSessions();
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string) {
    return this.adminService.revokeSession(id);
  }

  @Get('chat/sessions')
  getChatSessions() {
    return this.adminService.getChatSessions();
  }

  @Delete('chat/sessions/:id')
  deleteChatSession(@Param('id') id: string) {
    return this.adminService.deleteChatSession(id);
  }

  @Get('shrimp/species')
  getShrimpSpecies() {
    return this.adminService.getShrimpSpecies();
  }

  @Post('shrimp/test-analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
          return cb(
            new BadRequestException('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP).'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  testAnalyzeShrimp(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn hình ảnh để kiểm tra.');
    }
    return this.adminService.testAnalyze(file);
  }
}
