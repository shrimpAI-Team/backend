import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../shared/prisma/prisma.service';
import { SessionService } from '../auth/session.service';
import { ShrimpAnalysisService, UploadedFileParam } from '../shrimp-analysis/shrimp-analysis.service';
import { CreateUserDto, UserQueryDto } from './dto/admin.dto';
import { Role } from 'src/generated/prisma/enums';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly shrimpService: ShrimpAnalysisService,
  ) {}

  /**
   * Tổng quan thống kê hệ thống, KPI & giám sát sức khỏe dịch vụ
   */
  async getOverview() {
    // 1. Thống kê KPI database
    const [
      totalUsers,
      adminCount,
      activeUsers,
      lockedUsers,
      twoFactorCount,
      totalChatSessions,
      totalChatMessages,
      totalActiveSessions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { twoFactorEnabled: true } }),
      this.prisma.chatSession.count(),
      this.prisma.chatMessage.count(),
      this.prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

    // 2. Kiểm tra độ trễ database
    const dbStartTime = Date.now();
    let dbStatus = 'ONLINE';
    let dbLatencyMs = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStartTime;
    } catch {
      dbStatus = 'OFFLINE';
      dbLatencyMs = -1;
    }

    // 3. Kiểm tra trạng thái AI Service (FastAPI / local python)
    let aiStatus = 'UNKNOWN';
    let aiEngineType = 'Microservice (FastAPI)';
    try {
      const resp = await fetch('http://127.0.0.1:8000/docs', {
        method: 'HEAD',
        signal: AbortSignal.timeout(1500),
      });
      if (resp.ok) {
        aiStatus = 'FASTAPI_ONLINE (Port 8000)';
      } else {
        aiStatus = 'FASTAPI_OFFLINE (Fallback Python Engine)';
      }
    } catch {
      // Kiểm tra xem có python script hay venv không
      const venvPy = path.join(process.cwd(), 'ai-engine', 'venv', 'Scripts', 'python.exe');
      if (fs.existsSync(venvPy)) {
        aiStatus = 'PYTHON_VENV_READY (Fallback Mode)';
      } else {
        aiStatus = 'STANDALONE_FALLBACK_ACTIVE';
      }
      aiEngineType = 'Python Engine / Demo Fallback';
    }

    // 4. Thông số Node.js runtime
    const memUsage = process.memoryUsage();
    const systemInfo = {
      nodeVersion: process.version,
      platform: os.platform(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 4000,
    };

    // 5. 5 người dùng mới đăng ký
    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // 6. 5 phiên đăng nhập hoạt động gần nhất
    const recentSessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    return {
      kpis: {
        totalUsers,
        adminCount,
        activeUsers,
        lockedUsers,
        twoFactorCount,
        twoFactorRate: totalUsers > 0 ? Math.round((twoFactorCount / totalUsers) * 100) : 0,
        totalChatSessions,
        totalChatMessages,
        totalActiveSessions,
      },
      health: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        aiEngine: { status: aiStatus, type: aiEngineType },
        system: systemInfo,
      },
      recentUsers,
      recentSessions,
    };
  }

  /**
   * Danh sách người dùng nâng cao có phân trang, tìm kiếm và lọc
   */
  async getUsers(query: UserQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.role && query.role !== 'ALL') {
      where.role = query.role as Role;
    }

    if (query.status && query.status !== 'ALL') {
      if (query.status === 'ACTIVE') where.isActive = true;
      if (query.status === 'LOCKED') where.isActive = false;
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          twoFactorMethod: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              sessions: true,
              chatSessions: true,
              oauthAccounts: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Chi tiết người dùng kèm phiên và tài khoản OAuth
   */
  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { lastUsedAt: 'desc' },
          take: 20,
        },
        oauthAccounts: true,
        _count: {
          select: {
            chatSessions: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    // Bỏ password và TOTP secret trước khi trả về
    const { password, totpSecret, totpPendingSecret, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Admin tạo người dùng mới trực tiếp
   */
  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng trên hệ thống');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        name: dto.name || null,
        role: dto.role || Role.USER,
        isActive: true,
        emailVerifiedAt: new Date(), // Admin tạo thì kích hoạt luôn
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Cập nhật vai trò người dùng (USER <-> ADMIN)
   */
  async setUserRole(id: string, role: Role, currentAdminId: string) {
    if (id === currentAdminId && role !== Role.ADMIN) {
      throw new ForbiddenException('Bạn không thể tự hạ quyền ADMIN của chính mình');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    // Thu hồi toàn bộ session để buộc người dùng đăng nhập lại nhận token mang vai trò mới
    await this.sessions.revokeAll(id, 'ROLE_CHANGED_BY_ADMIN');
    return user;
  }

  /**
   * Khóa hoặc kích hoạt lại tài khoản
   */
  async setUserStatus(id: string, isActive: boolean, currentAdminId: string) {
    if (id === currentAdminId && !isActive) {
      throw new ForbiddenException('Bạn không thể tự khóa tài khoản của chính mình');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!isActive) {
      await this.sessions.revokeAll(id, 'ACCOUNT_LOCKED_BY_ADMIN');
    }

    return user;
  }

  /**
   * Đặt lại mật khẩu người dùng
   */
  async resetUserPassword(id: string, newPass: string) {
    if (!newPass || newPass.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có tối thiểu 6 ký tự');
    }

    const hashedPassword = await bcrypt.hash(newPass, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Thu hồi phiên để đăng nhập lại bằng mật khẩu mới
    await this.sessions.revokeAll(id, 'PASSWORD_RESET_BY_ADMIN');
    return { success: true, message: 'Đã đặt lại mật khẩu thành công' };
  }

  /**
   * Xóa vĩnh viễn tài khoản người dùng
   */
  async deleteUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new ForbiddenException('Bạn không thể tự xóa tài khoản của chính mình');
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'Đã xóa người dùng thành công' };
  }

  /**
   * Lấy tất cả phiên đăng nhập hệ thống (cho kiểm toán bảo mật)
   */
  async getAllSessions() {
    return this.prisma.session.findMany({
      orderBy: { lastUsedAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * Thu hồi phiên đăng nhập đơn lẻ
   */
  async revokeSession(sessionId: string) {
    await this.sessions.revokeSession(sessionId, 'REVOKED_BY_ADMIN');
    return { success: true, message: 'Đã thu hồi phiên đăng nhập' };
  }

  /**
   * Thu hồi tất cả phiên đăng nhập của người dùng
   */
  async revokeAllUserSessions(userId: string) {
    await this.sessions.revokeAll(userId, 'REVOKED_ALL_BY_ADMIN');
    return { success: true, message: 'Đã đăng xuất tài khoản khỏi tất cả thiết bị' };
  }

  /**
   * Giám sát các phiên hội thoại AI
   */
  async getChatSessions() {
    return this.prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * Xóa phiên hội thoại AI (kiểm duyệt)
   */
  async deleteChatSession(sessionId: string) {
    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });
    return { success: true, message: 'Đã xóa phiên chat' };
  }

  /**
   * Danh mục giống tôm hỗ trợ
   */
  getShrimpSpecies() {
    return this.shrimpService.getSupportedSpecies();
  }

  /**
   * Test chẩn đoán ảnh tôm trực tiếp cho Admin
   */
  async testAnalyze(file: UploadedFileParam) {
    const startTime = Date.now();
    const result = await this.shrimpService.analyze(file);
    const totalLatencyMs = Date.now() - startTime;

    return {
      ...result,
      diagnostics: {
        serverExecutionMs: totalLatencyMs,
        receivedFilename: file.originalname,
        fileSizeKb: Math.round(file.size / 1024),
        mimeType: file.mimetype,
      },
    };
  }
}
