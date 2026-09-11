import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../shared/prisma/prisma.service';

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
    return this.prisma.chatSession.create({
      data: {
        userId,
        title: title?.trim() || 'Cuộc trò chuyện mới',
      },
    });
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
   * Gửi tin nhắn và nhận phản hồi từ Gemini AI
   */
  async sendMessage(userId: string, sessionId: string, userContent: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10, // Lấy 10 tin nhắn gần nhất để giữ ngữ cảnh
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
    const userMsg = await this.prisma.chatMessage.create({
      data: {
        chatSessionId: sessionId,
        role: 'user',
        content: userContent,
      },
    });

    // 2. Cập nhật tiêu đề phiên chat nếu đây là tin nhắn đầu tiên
    if (session.title === 'Cuộc trò chuyện mới' || session.title === 'Đoạn chat mới') {
      const newTitle = userContent.length > 35 ? `${userContent.substring(0, 35)}...` : userContent;
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: newTitle },
      });
    }

    // 3. Gọi Gemini API
    let aiResponseText = '';
    const geminiApiKey = this.configService.get<string>('gemini.apiKey');
    const geminiModel = this.configService.get<string>('gemini.model') || 'gemini-1.5-flash';

    if (geminiApiKey && geminiApiKey.trim().length > 5) {
      try {
        aiResponseText = await this.callGeminiApi(
          geminiApiKey,
          geminiModel,
          session.messages,
          userContent,
        );
      } catch (err: any) {
        this.logger.error(`Lỗi gọi Gemini API: ${err.message}`);
        aiResponseText = this.getFallbackResponse(userContent);
      }
    } else {
      // Fallback thông minh nếu chưa có API Key
      aiResponseText = this.getFallbackResponse(userContent);
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
    const systemInstruction = `Bạn là Trợ lý AI Chuyên gia Thủy sản & Giống tôm cao cấp của hệ thống shrimpAI (Việt Nam).
Nhiệm vụ của bạn là tư vấn chuyên sâu, chính xác, khoa học và thực tiễn cho người nuôi tôm và sinh viên làm khóa luận thủy sản.
Các lĩnh vực bạn nắm vững:
1. Nhận dạng và đặc điểm sinh học của 3 giống tôm chủ lực:
   - Tôm thẻ chân trắng (Litopenaeus vannamei): Vỏ mỏng trong suốt, chân bơi màu trắng sữa, lớn nhanh, nuôi mật độ cao.
   - Tôm sú (Penaeus monodon): Vỏ dày, sọc vân đen nâu/đen vàng rõ rệt, kích thước lớn, giá trị xuất khẩu cao.
   - Tôm càng xanh (Macrobrachium rosenbergii): Càng dài màu xanh dương đặc trưng, tôm nước ngọt ĐBSCL.
2. Dịch bệnh thủy sản và cách nhận biết/xử lý (Đốm trắng WSSV, Đầu vàng YHV, Hoại tử gan tụy cấp AHPND, Vi bào tử trùng EHP, Bệnh phân trắng...).
3. Quản lý chất lượng nước ao nuôi (pH lý tưởng 7.5 - 8.5, độ kiềm 120 - 160 mg/L, oxy hòa tan > 4-5 mg/L, khử độc NH3/NO2/H2S).
4. Kỹ thuật cho ăn, quản lý quạt nước, vi sinh xử lý đáy ao.
5. Giải đáp mọi thắc mắc chung một cách lịch sự, tận tâm, dùng tiếng Việt chuẩn mực, định dạng Markdown rõ ràng, có tiêu đề và gạch đầu dòng khoa học.`;

    const contents: any[] = [];

    // Chuyển đổi lịch sử chat sang định dạng Gemini
    for (const msg of historyMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Thêm tin nhắn hiện tại
    contents.push({
      role: 'user',
      parts: [{ text: newPrompt }],
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000), // Timeout 20s
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google API status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Không nhận được nội dung trả lời từ Gemini.');
    }

    return text;
  }

  /**
   * Phản hồi dự phòng thông minh khi chưa có hoặc lỗi Gemini API Key
   */
  private getFallbackResponse(query: string): string {
    const q = query.toLowerCase();

    if (q.includes('phân biệt') || q.includes('giống tôm') || q.includes('loại tôm') || q.includes('so sánh')) {
      return `### 🦐 Hướng dẫn phân biệt 3 giống tôm thương phẩm chủ lực tại Việt Nam:

1. **Tôm thẻ chân trắng (*Litopenaeus vannamei*)**:
   - **Đặc điểm**: Vỏ mỏng, nhẵn bóng và có màu xám sáng hoặc trong suốt mờ. Điểm đặc trưng nhất là **toàn bộ chân bò và chân bơi có màu trắng sữa sáng rõ**.
   - **Tập tính**: Bơi lội hoạt bát, chịu được biên độ độ mặn rộng (từ 5‰ đến 35‰), thích hợp nuôi thâm canh mật độ cao.

2. **Tôm sú (*Penaeus monodon*)**:
   - **Đặc điểm**: Vỏ rất dày, cứng cáp. Thân có **các dải vân sọc ngang màu đen vàng hoặc đen nâu tương phản rất rõ nét** trên lưng. Chân bơi có sắc đỏ cam hoặc sẫm màu.
   - **Tập tính**: Thích sống đáy, kích thước lớn vượt trội (10 - 20 con/kg), giá trị kinh tế xuất khẩu cao.

3. **Tôm càng xanh (*Macrobrachium rosenbergii*)**:
   - **Đặc điểm**: Cặp chân kìm thứ hai phát triển thành **đôi càng dài màu xanh dương rực rỡ**. Thân màu xanh lục nhạt hoặc xám.
   - **Môi trường**: Sống ở vùng nước ngọt và nước lợ nhẹ ĐBSCL.

> 💡 *Hệ thống đang chạy chế độ Tri thức chuyên sâu shrimpAI.*`;
    }

    if (q.includes('ph') || q.includes('mặn') || q.includes('oxy') || q.includes('nước') || q.includes('kiềm') || q.includes('môi trường')) {
      return `### 🧪 Chỉ số môi trường nước lý tưởng cho ao nuôi tôm:

- **Độ pH**: Dao động lý tưởng từ **7.5 - 8.5** (chênh lệch giữa sáng và chiều không quá 0.5).
- **Độ kiềm (Alkalinity)**: **120 - 160 mg/L CaCO3** đối với tôm thẻ, giúp tôm cứng vỏ nhanh sau khi lột.
- **Oxy hòa tan (DO)**: Duy trì **> 4.0 - 5.0 mg/L** (đặc biệt vào ban đêm và lúc rạng sáng cần chạy quạt nước liên tục).
- **Nhiệt độ nước**: Thích hợp nhất từ **28 - 30°C**.
- **Khí độc hại**: 
  - $NH_3$ (Ammonia tự do): $< 0.1$ mg/L.
  - $NO_2^-$ (Nitrit): Càng thấp càng tốt ($< 0.2$ mg/L).
  - $H_2S$ (Hydro sunfua): $< 0.03$ mg/L (cực độc cho đáy ao).

> 💡 *Bạn nên kiểm tra định kỳ 2 lần/ngày (6h sáng và 14h chiều) để kịp thời điều chỉnh vôi hoặc bổ sung vi sinh xử lý đáy ao.*`;
    }

    if (q.includes('đốm trắng') || q.includes('wssv') || q.includes('bệnh') || q.includes('gan tụy') || q.includes('phân trắng')) {
      return `### ⚠️ Cảnh báo và Phòng trị Dịch bệnh Tôm phổ biến:

1. **Bệnh Đốm trắng (WSSV - White Spot Syndrome Virus)**:
   - **Dấu hiệu**: Xuất hiện các đốm trắng tròn đường kính 0.5 - 2mm bên trong vỏ giáp đầu ngực và đốt thân thứ 5, 6; tôm dạt bờ, tấp mé và chết nhanh trong 3 - 5 ngày.
   - **Xử lý**: Đây là bệnh do virus nên không có thuốc đặc trị. Cần diệt giáp xác trung gian, an toàn sinh học và kiểm soát nguồn nước cấp.

2. **Bệnh Hoại tử gan tụy cấp (AHPND / EMS)**:
   - **Tác nhân**: Vi khuẩn *Vibrio parahaemolyticus* mang độc tố Photorhabdus luminescens.
   - **Dấu hiệu**: Gan tụy teo nhỏ, nhạt màu hoặc đen chai, ruột rỗng không có thức ăn, tôm rớt đáy đột ngột sau 10 - 35 ngày thả giống.
   - **Phòng bệnh**: Sử dụng tôm giống SPF, xử lý diệt khuẩn nguồn nước và dùng chế phẩm sinh học đối kháng.

3. **Bệnh Phân trắng (White Feces Disease)**:
   - **Dấu hiệu**: Sợi phân màu trắng nổi trên mặt nước và tích tụ ở cuối góc quạt nước, tôm giảm ăn và ốp thân.
   - **Cách xử lý**: Giảm 30 - 50% lượng thức ăn, bổ sung men tiêu hóa và thảo dược ức chế vi bào tử EHP.`;
    }

    return `Xin chào bạn! Tôi là **Trợ lý AI Thủy sản shrimpAI**. 

Tôi có thể hỗ trợ bạn mọi thắc mắc chuyên môn:
- 🦐 **Phân biệt đặc điểm giải phẫu học các giống tôm**: Tôm thẻ chân trắng, Tôm sú, Tôm càng xanh...
- 🧪 **Kiểm soát chất lượng nước ao nuôi**: pH, độ kiềm, oxy hòa tan, xử lý khí độc NH3, NO2.
- ⚠️ **Chẩn đoán & phòng ngừa dịch bệnh**: Đốm trắng (WSSV), Hoại tử gan tụy (AHPND), Bệnh phân trắng...
- 🍽️ **Kỹ thuật quản lý thức ăn & chế độ dinh dưỡng theo từng giai đoạn lột xác**.

Bạn cần tư vấn vấn đề gì về ao tôm của mình hôm nay?`;
  }
}
