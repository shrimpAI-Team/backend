import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../shared/prisma/prisma.service';
import { AquacultureExpert } from './aquaculture-expert';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Lấy danh sách các cuộc trò chuyện của User
   */
  async getSessions(userId: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true, role: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
      lastMessage: s.messages[0] || null,
    }));
  }

  /**
   * Tạo phiên trò chuyện mới
   */
  async createSession(userId: string, title?: string) {
    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        title: title?.trim() || 'Cuộc trò chuyện mới',
      },
    });

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: 0,
      lastMessage: null,
    };
  }

  /**
   * Lấy chi tiết lịch sử tin nhắn của một phiên chat
   */
  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện này.');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập cuộc trò chuyện này.');
    }

    return session;
  }

  /**
   * Xóa một phiên chat
   */
  async deleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa cuộc trò chuyện này.');
    }

    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return { success: true, message: 'Đã xóa cuộc trò chuyện thành công.' };
  }

  /**
   * Gửi tin nhắn và nhận phản hồi từ AI
   */
  async sendMessage(userId: string, sessionId: string, userContent: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 12, // Lấy 12 tin nhắn gần nhất để giữ mạch ngữ cảnh
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện này.');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập cuộc trò chuyện này.');
    }

    // 1. Lưu tin nhắn của người dùng vào Database
    await this.prisma.chatMessage.create({
      data: {
        chatSessionId: sessionId,
        role: 'user',
        content: userContent,
      },
    });

    // 2. Cập nhật tiêu đề phiên chat nếu đây là câu hỏi đầu tiên
    if (session.title === 'Cuộc trò chuyện mới' || session.title === 'Đoạn chat mới') {
      const newTitle = userContent.length > 35 ? `${userContent.substring(0, 35)}...` : userContent;
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: newTitle },
      });
    }

    // 3. Xử lý gọi AI qua Google Gemini API
    let aiResponseText = '';
    const geminiApiKey = this.configService.get<string>('gemini.apiKey');
    const geminiModel = this.configService.get<string>('gemini.model') || 'gemini-2.5-flash-lite';

    if (geminiApiKey && geminiApiKey.trim().length > 10) {
      try {
        this.logger.log(`Đang gọi Google Gemini (${geminiModel})...`);
        aiResponseText = await this.callGeminiApi(
          geminiApiKey,
          geminiModel,
          session.messages,
          userContent,
        );
      } catch (geminiErr: any) {
        this.logger.warn(`Lỗi Gemini API: ${geminiErr.message}. Chuyển sang động cơ tri thức shrimpAI...`);
      }
    }

    // Dự phòng tri thức chuyên gia Thủy sản shrimpAI nếu chưa cấu hình key hoặc có lỗi
    if (!aiResponseText) {
      this.logger.log('Sử dụng shrimpAI Senior Aquaculture Expert Engine...');
      aiResponseText = AquacultureExpert.generateResponse(userContent, session.messages);
    }

    // 4. Lưu phản hồi của AI vào Database
    const assistantMsg = await this.prisma.chatMessage.create({
      data: {
        chatSessionId: sessionId,
        role: 'assistant',
        content: aiResponseText,
      },
    });

    // 5. Cập nhật thời gian updatedAt của session
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return assistantMsg;
  }

  /**
   * Gọi Google Gemini REST API trực tiếp
   */
  private async callGeminiApi(
    apiKey: string,
    modelName: string,
    historyMessages: Array<{ role: string; content: string }>,
    newPrompt: string,
  ): Promise<string> {
    const systemInstruction = `Bạn là Trợ lý AI Chuyên gia Thủy sản & Bệnh học Tôm của hệ thống shrimpAI (Việt Nam).
Nhiệm vụ của bạn là tư vấn chuyên sâu, chính xác, thực tiễn và khoa học cho người nuôi tôm và kỹ sư thủy sản.
Các lĩnh vực chuyên môn:
1. Giống tôm & Giải phẫu: Tôm thẻ chân trắng (Litopenaeus vannamei), Tôm sú (Penaeus monodon), Tôm càng xanh (Macrobrachium rosenbergii).
2. Dịch bệnh thủy sản: Đốm trắng (WSSV), Hoại tử gan tụy cấp (AHPND/EMS), Vi bào tử trùng (EHP), Phân trắng (WFD), Đầu vàng (YHV), Đục cơ cong thân (IMNV).
3. Quản lý chất lượng nước: pH (7.5-8.5), Độ kiềm (120-160 mg/L), Oxy hòa tan DO (> 4.5 mg/L), Xử lý khí độc NH3, NO2-, H2S bằng Yucca, vôi, vi sinh, muối hột.
4. Kỹ thuật cho ăn, quản lý FCR, bố trí quạt nước, công nghệ vi sinh Biofloc, ủ EM tỏi / EM chuối.
Quy chuẩn trả lời:
- Luôn trả lời bằng tiếng Việt chuẩn mực, mạch lạc, tích cực và thân thiện.
- Trình bày định dạng Markdown rõ ràng, sử dụng tiêu đề H3 (###), bảng biểu Markdown so sánh khi cần, gạch đầu dòng và trích dẫn ghi chú (> 💡).`;

    const contents: any[] = [];

    // Chuyển đổi lịch sử chat sang định dạng Gemini
    for (const msg of historyMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Thêm câu hỏi mới của người dùng
    contents.push({
      role: 'user',
      parts: [{ text: newPrompt }],
    });

    // Hỗ trợ thử các model mới nhất của Google Gemini (ưu tiên model ổn định và nhanh nhất)
    const modelsToTry = [
      modelName,
      'gemini-2.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError: any = null;

    for (const model of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 2500,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000), // 30s timeout cho model lớn
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google API status ${res.status} (${model}): ${errText}`);
        }

        const data = (await res.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        this.logger.debug(`Thử model ${model} thất bại: ${err.message}`);
      }
    }

    throw lastError || new Error('Không nhận được nội dung phản hồi từ Gemini API.');
  }
}


