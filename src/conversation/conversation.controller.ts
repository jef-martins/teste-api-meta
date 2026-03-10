import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversas')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private conversationService: ConversationService) {}

  @Get()
  listar() {
    return this.conversationService.listar();
  }
}
