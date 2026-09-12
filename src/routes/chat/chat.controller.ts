import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import type { AuthUser } from '../shared/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  getSessions(@CurrentUser() user: AuthUser) {
    return this.chatService.getSessions(user.id);
  }

  @Post('sessions')
  createSession(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.chatService.createSession(user.id, dto?.title);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.getSession(user.id, id);
  }

  @Delete('sessions/:id')
  deleteSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.deleteSession(user.id, id);
  }

  @Post('sessions/:id/messages')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, id, dto.content);
  }
}
