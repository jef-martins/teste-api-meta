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
  listar(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.service.listar(req.user.id, this.getSubOrgId(headers));
  }

  @Get(':id')
  obter(@Param('id') id: string, @Req() req: any) {
    return this.service.obter(id, req.user.id);
  }

  @Post()
  criar(
    @Req() req: any,
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
    @Req() req: any,
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
  excluir(@Param('id') id: string, @Req() req: any) {
    return this.service.excluir(id, req.user.id);
  }
}
