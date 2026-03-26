import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomComponentService } from './custom-component.service';

@Controller('custom-components')
@UseGuards(JwtAuthGuard)
export class CustomComponentController {
  constructor(private service: CustomComponentService) {}

  private getSubOrgId(headers: Record<string, string>): string | null {
    return headers['x-suborg-id'] || null;
  }

  @Get()
  listar(
    @Req() req: RequestWithUser,
    @Headers() headers: Record<string, string>,
  ) {
    return this.service.listar(req.user.id, this.getSubOrgId(headers));
  }

  @Get(':id')
  obter(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.service.obter(id, req.user.id);
  }

  @Post()
  criar(
    @Req() req: RequestWithUser,
    @Headers() headers: Record<string, string>,
    @Body()
    body: {
      nome: string;
      descricao?: string;
      icone?: string;
      nodesJson: object;
    },
  ) {
    return this.service.criar(req.user.id, this.getSubOrgId(headers), body);
  }

  @Put(':id')
  atualizar(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body()
    body: {
      nome?: string;
      descricao?: string;
      icone?: string;
      nodesJson?: object;
    },
  ) {
    return this.service.atualizar(id, req.user.id, body);
  }

  @Delete(':id')
  excluir(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.service.excluir(id, req.user.id);
  }
}
